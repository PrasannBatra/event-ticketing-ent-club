"use client";

import { supabase } from "./supabase";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

async function adminApi<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { ...(init.headers ?? {}), ...(await authHeader()) } });
  } catch {
    throw new Error("Can't reach the server. Check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? "Something went wrong.");
  return body as T;
}

export interface AdminStats {
  total_users: number;
  total_tickets: number;
  total_revenue: number;
  pending_approvals: number;
  total_events: number;
  total_registrations: number;
  checked_in: number;
  approved_orders: number;
  rejected_orders: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  ticket_count: number;
  order_count: number;
}

export interface AdminUserDetail {
  user: { id: string; name: string; email: string; student_id: string | null; role: string; created_at: string };
  orders: {
    id: string; event_id: string; event_name: string; amount: number;
    payment_status: string; reject_reason: string | null; created_at: string;
    email_status: string; ticket_id: string | null;
  }[];
  tickets: {
    id: string; event_id: string; event_name: string; status: string;
    checked_in_at: string | null; created_at: string;
  }[];
}

export interface AdminOrder {
  order_id: string;
  user_id: string;
  buyer_name: string;
  buyer_email: string;
  event_id: string;
  event_name: string;
  amount: number;
  payment_status: string;
  reject_reason: string | null;
  email_status: string;
  screenshot_path: string;
  screenshot_url: string | null;
  created_at: string;
  ticket_id: string | null;
  ticket_status: string | null;
  checked_in_at: string | null;
}

export interface AdminTicket {
  ticket_id: string;
  user_id: string;
  buyer_name: string;
  buyer_email: string;
  event_id: string;
  event_name: string;
  status: string;
  checked_in_at: string | null;
  created_at: string;
  order_id: string;
  payment_status: string;
  email_status: string;
}

export interface AdminEvent {
  id: string;
  name: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  poster_url: string | null;
  ticket_price: number;
  capacity: number | null;
  sales_open: string;
  sales_close: string;
  organiser_id: string;
  organiser_name: string;
  published: boolean;
  archived: boolean;
  created_at: string;
  sold: number;
  revenue: number;
  checked_in: number;
  pending: number;
}

export const adminClient = {
  stats: () => adminApi<AdminStats>("/api/admin/stats"),
  users: (q: string) => adminApi<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`),
  userDetail: (id: string) => adminApi<AdminUserDetail>(`/api/admin/users/${id}`),
  orders: (eventId?: string, status?: string) =>
    adminApi<{ orders: AdminOrder[] }>(`/api/admin/orders${eventId || status ? "?" : ""}${eventId ? `eventId=${eventId}` : ""}${eventId && status ? "&" : ""}${status ? `status=${status}` : ""}`),
  tickets: (q: string) => adminApi<{ tickets: AdminTicket[] }>(`/api/admin/tickets?q=${encodeURIComponent(q)}`),
  events: () => adminApi<{ events: AdminEvent[] }>("/api/admin/events"),
  eventDetail: (id: string) => adminApi<{ event: AdminEvent; stats: any; attendees: any[]; pending: any[]; email: any }>(`/api/admin/events/${id}`),
  createEvent: (form: FormData) => adminApi<{ id: string }>("/api/admin/events/new", { method: "POST", body: form }),
  updateEvent: (id: string, form: FormData) => adminApi<{ ok: boolean }>(`/api/admin/events/${id}`, { method: "PUT", body: form }),
  deleteEvent: (id: string) => adminApi<{ ok: boolean }>(`/api/admin/events/${id}`, { method: "DELETE" }),
  reviewPayments: (orderIds: string[], approve: boolean, reason?: string) =>
    adminApi<{ decided: number; skipped: number }>("/api/admin/payments/review", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds, approve, reason: reason ?? null }),
    }),
  sendEmails: (eventId: string, retryFailed?: boolean) =>
    adminApi<{ sent: number; failed: number; remaining: number; failedTotal: number }>(`/api/admin/events/${eventId}/send-emails`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retryFailed: retryFailed === true }),
    }),
  resendEmail: (orderId: string) => adminApi<{ ok: boolean; to: string }>(`/api/admin/payments/${orderId}/resend`, { method: "POST" }),
  checkIn: (token: string, eventId: string) =>
    adminApi<{ kind: string; name?: string; ticketId?: string; at?: string; eventName?: string }>("/api/admin/checkin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, eventId }),
    }),
};
