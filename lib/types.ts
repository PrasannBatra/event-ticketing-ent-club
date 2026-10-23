// Mirrors the data model in section 5.2 of the plan (camelCase for the front-end).

export type Role = "student" | "organiser" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  studentId: string; // may be empty for Google sign-in users
  role: Role;
  createdAt: string;
}

export interface EventT {
  id: string;
  name: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (24h)
  venue: string;
  posterUrl?: string; // Supabase Storage URL in production
  posterTheme: number; // generated artwork used when no poster is uploaded
  price: number; // INR, one standard price per event (V1 rule 1)
  capacity?: number; // organiser-only (V1 rule 3)
  salesOpen: string; // ISO datetime
  salesClose: string; // ISO datetime
  organiserId: string;
  createdAt: string;
  soldOut?: boolean; // computed by the database; students never see counts
}

// A student uploads a payment screenshot; the event's organiser approves or rejects it.
export type PaymentStatus = "awaiting_review" | "approved" | "rejected";

export interface Order {
  id: string;
  userId: string;
  eventId: string;
  amount: number; // stored on the order so later price changes don't affect it
  screenshotPath: string; // file in the private payment-screenshots bucket
  paymentStatus: PaymentStatus;
  rejectReason?: string;
  emailStatus?: "none" | "pending" | "sending" | "sent" | "failed";
  createdAt: string;
}

export type TicketStatus = "active" | "used";

export interface Ticket {
  id: string; // human-readable ticket ID shown on screen and in CSV
  orderId: string;
  userId: string;
  eventId: string;
  token: string; // random, unguessable. The QR encodes ONLY this.
  status: TicketStatus;
  checkedInAt?: string;
  checkedInBy?: string;
  createdAt: string;
}

export type SalesState = "open" | "upcoming" | "closed" | "soldout";

export interface NewEventInput {
  name: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  posterUrl?: string;
  price: number;
  capacity?: number;
  salesOpen: string;
  salesClose: string;
}

export type CheckInResult =
  | { kind: "valid"; ticket: Ticket; name: string }
  | { kind: "used"; ticket: Ticket; name: string; at: string }
  | { kind: "wrong_event"; eventName: string; name: string }
  | { kind: "invalid" };

export interface EventStats {
  sold: number;
  revenue: number;
  checkedIn: number;
  pending: number; // screenshots waiting for review
  capacity?: number;
  remaining?: number;
}

export interface Attendee {
  ticket: Ticket;
  user: User;
  order?: Order;
}

export interface PendingPayment {
  order: Order;
  user: User;
  duplicates: number; // how many OTHER payments used the exact same screenshot (a sign of a fake or re-used one)
}

export interface EmailRun {
  sent: number;
  failed: number;
  remaining: number;
  error?: string;
}
