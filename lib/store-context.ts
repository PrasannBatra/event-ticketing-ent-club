"use client";

import { createContext, useContext } from "react";
import type {
  Attendee, CheckInResult, EventStats, EventT, NewEventInput, Order, PendingPayment, Role, SalesState, Ticket, User,
} from "./types";

export interface Store {
  ready: boolean;
  demo: boolean; // true = sample data in the browser, false = real Supabase backend
  user: User | null;
  events: EventT[];
  tickets: Ticket[]; // the signed-in student's tickets
  orders: Order[]; // the signed-in student's payment submissions

  // auth (Ashoka email only)
  signUp: (i: { name: string; email: string; studentId: string; password: string }) => Promise<{ error?: string; confirm?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  signInDemo?: (role: Role) => void;
  resetDemo?: () => void;
  demoScanTokens?: (eventId: string) => { valid?: string; other?: string };

  // reading
  getEvent: (id: string) => EventT | undefined;
  getStats: (eventId: string) => EventStats;
  salesState: (e: EventT) => SalesState;
  myTickets: () => Ticket[];

  // student: pay by uploading a screenshot
  submitPayment: (eventId: string, file: File) => Promise<{ ok: true } | { ok: false; reason: string }>;

  // organiser
  createEvent: (input: NewEventInput, poster?: File | null) => Promise<string>;
  loadEvent: (eventId: string) => Promise<void>;
  attendees: (eventId: string) => Attendee[];
  pendingPayments: (eventId: string) => PendingPayment[];
  reviewPayment: (orderId: string, approve: boolean, reason?: string) => Promise<{ error?: string; notice?: string }>;
  resendTicketEmail: (orderId: string) => Promise<string>; // returns a message to show the organiser
  screenshotUrl: (path: string) => Promise<string | null>;
  checkIn: (token: string, eventId: string) => Promise<CheckInResult>;

  // organiser team
  listUsers: (search: string) => Promise<User[]>;
  setUserRole: (email: string, role: "student" | "organiser") => Promise<string | null>;
  exportAttendees: (eventId: string) => Promise<string | null>; // null = downloaded, otherwise an error message
}

export const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}

/** Time window plus the database's sold-out flag. Students never get a seat count. */
export function salesStateOf(e: EventT): SalesState {
  const now = Date.now();
  if (now < new Date(e.salesOpen).getTime()) return "upcoming";
  if (now > new Date(e.salesClose).getTime()) return "closed";
  if (e.soldOut) return "soldout";
  return "open";
}

export const ORDER_ERRORS: Record<string, string> = {
  sales_closed: "Ticket sales for this event are closed.",
  sales_not_open: "Ticket sales haven't opened yet.",
  sold_out: "Ticket sales for this event are closed.",
  already_has_ticket: "You already have a ticket, or a payment waiting for review, for this event.",
  not_student: "Only student accounts can buy tickets.",
  not_signed_in: "Please sign in to continue.",
  event_not_found: "We couldn't find this event.",
};

export function orderError(message: string): string {
  const key = Object.keys(ORDER_ERRORS).find((k) => message.includes(k));
  return key ? ORDER_ERRORS[key] : "Something went wrong. Please try again.";
}

export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
