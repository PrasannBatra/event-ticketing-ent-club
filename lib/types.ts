// Mirrors the data model in section 5.2 of the plan (camelCase for the front-end).

export type Role = "student" | "organiser";

export interface User {
  id: string;
  name: string;
  email: string;
  studentId: string;
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
}

export type PaymentStatus = "pending" | "paid" | "failed";

export interface Order {
  id: string;
  userId: string;
  eventId: string;
  amount: number; // stored on the order so later price changes don't affect it
  paymentId: string;
  paymentStatus: PaymentStatus;
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

export type StartOrderResult =
  | { ok: true; order: Order }
  | { ok: false; reason: "auth" | "role" | "closed" | "upcoming" | "limit" | "missing" };

export type CheckInResult =
  | { kind: "valid"; ticket: Ticket; name: string }
  | { kind: "used"; ticket: Ticket; name: string; at: string }
  | { kind: "wrong_event"; eventName: string; name: string }
  | { kind: "invalid" };

export interface EventStats {
  sold: number;
  revenue: number;
  checkedIn: number;
  capacity?: number;
  remaining?: number;
}

export interface Attendee {
  ticket: Ticket;
  user: User;
  order?: Order;
}
