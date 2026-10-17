"use client";

/**
 * Real backend. Sign-in and sign-up go straight to Supabase Auth. Everything else (events, orders,
 * tickets, payment review, check-in, CSV) goes through the Next.js API routes in app/api/*,
 * which run the business logic on the server. The browser never talks to the database itself.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { isAshokaEmail, STUDENT_EMAIL_DOMAIN } from "./config";
import { supabase } from "./supabase";
import { Ctx, MAX_SCREENSHOT_BYTES, downloadBlob, salesStateOf, type Store } from "./store-context";
import type { Attendee, CheckInResult, EventStats, EventT, Order, PendingPayment, Ticket, User } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
class ApiFail extends Error {}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { ...(init.headers ?? {}), ...(await authHeader()) } });
  } catch {
    throw new ApiFail("Can't reach the server. Check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiFail(body?.error?.message ?? "Something went wrong. Please try again.");
  return body as T;
}

const userFrom = (r: any): User => ({ id: r.id, name: r.name, email: r.email, studentId: r.student_id, role: r.role, createdAt: r.created_at });
const eventFrom = (r: any): EventT => ({
  id: r.id, name: r.name, description: r.description, date: r.date, time: String(r.time).slice(0, 5), venue: r.venue,
  posterUrl: r.poster_url ?? undefined, posterTheme: String(r.name).length % 5, price: Number(r.ticket_price),
  capacity: r.capacity ?? undefined, salesOpen: r.sales_open, salesClose: r.sales_close,
  organiserId: r.organiser_id ?? "", createdAt: r.created_at ?? "", soldOut: r.sold_out ?? false,
});
const ticketFrom = (r: any): Ticket => ({
  id: r.id, orderId: r.order_id, userId: r.user_id, eventId: r.event_id, token: r.token, status: r.status,
  checkedInAt: r.checked_in_at ?? undefined, checkedInBy: r.checked_in_by ?? undefined, createdAt: r.created_at,
});
const orderFrom = (r: any): Order => ({
  id: r.id, userId: r.user_id, eventId: r.event_id, amount: Number(r.amount), screenshotPath: r.screenshot_path,
  paymentStatus: r.payment_status, rejectReason: r.reject_reason ?? undefined, createdAt: r.created_at,
});
const statsFrom = (r: any, cap?: number): EventStats => ({
  sold: r.sold, revenue: Number(r.revenue), checkedIn: r.checked_in, pending: r.pending, capacity: cap,
  remaining: cap !== undefined ? Math.max(cap - r.sold - r.pending, 0) : undefined,
});

/** Phone screenshots can be several MB. Shrink them first so uploads are fast and fit the server limit. */
async function shrink(file: File): Promise<File> {
  try {
    if (file.size < 600_000) return file;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")?.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? new File([blob], "screenshot.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<EventT[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Record<string, EventStats>>({});
  const [att, setAtt] = useState<Record<string, Attendee[]>>({});
  const [pend, setPend] = useState<Record<string, PendingPayment[]>>({});

  const loadAll = useCallback(async (signedIn: boolean) => {
    try {
      if (!signedIn) {
        setUser(null); setTickets([]); setOrders([]); setStats({}); setAtt({}); setPend({});
        setEvents((await api("/api/events")).events.map(eventFrom));
        return;
      }
      const me = userFrom((await api("/api/me")).user);
      setUser(me);
      if (me.role !== "student") {
        const r = await api("/api/organiser/events");
        const evs: EventT[] = r.events.map(eventFrom);
        const map: Record<string, EventStats> = {};
        r.stats.forEach((s: any) => { map[s.event_id] = statsFrom(s, evs.find((e) => e.id === s.event_id)?.capacity); });
        setStats(map);
        setEvents(evs.map((e) => ({ ...e, soldOut: e.capacity !== undefined && !!map[e.id] && map[e.id].sold + map[e.id].pending >= e.capacity })));
        setTickets([]); setOrders([]);
      } else {
        const [ev, tk, od] = await Promise.all([api("/api/events"), api("/api/tickets"), api("/api/orders")]);
        setEvents(ev.events.map(eventFrom));
        setTickets(tk.tickets.map(ticketFrom));
        setOrders(od.orders.map(orderFrom));
      }
    } catch {
      /* leave whatever is already on screen; the next action will show an error */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      await loadAll(!!data.session);
      if (alive) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setTimeout(() => loadAll(!!session), 0); // never await Supabase calls inside this callback
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadAll]);

  const store = useMemo<Store>(() => {
    const loadEvent: Store["loadEvent"] = async (eventId) => {
      try {
        const r = await api(`/api/organiser/events/${eventId}`);
        setAtt((m) => ({
          ...m,
          [eventId]: r.attendees.map((a: any): Attendee => ({
            ticket: { id: a.ticket_id, orderId: a.order_id, userId: a.user_id, eventId, token: "", status: a.status, checkedInAt: a.checked_in_at ?? undefined, createdAt: a.bought_at },
            user: { id: a.user_id, name: a.name, email: a.email, studentId: a.student_id, role: "student", createdAt: "" },
            order: { id: a.order_id, userId: a.user_id, eventId, amount: Number(a.amount), screenshotPath: "", paymentStatus: "approved", createdAt: a.bought_at },
          })),
        }));
        setPend((m) => ({
          ...m,
          [eventId]: r.pending.map((p: any): PendingPayment => ({
            // screenshotPath holds a short-lived signed link in this mode
            order: { id: p.order_id, userId: p.user_id, eventId, amount: Number(p.amount), screenshotPath: p.screenshot_url ?? "", paymentStatus: "awaiting_review", createdAt: p.submitted_at },
            user: { id: p.user_id, name: p.name, email: p.email, studentId: p.student_id, role: "student", createdAt: "" },
          })),
        }));
        if (r.stats) setStats((m) => ({ ...m, [eventId]: statsFrom(r.stats, r.event.capacity ?? undefined) }));
      } catch { /* shown as empty lists */ }
    };

    return {
      ready, demo: false, user, events, tickets, orders,

      signUp: async ({ name, email, studentId, password }) => {
        if (!isAshokaEmail(email)) return { error: `Use your @${STUDENT_EMAIL_DOMAIN} email address.` };
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(), password,
          options: { data: { name: name.trim(), student_id: studentId.trim() }, emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
        });
        if (error) return { error: /already|registered/i.test(error.message) ? "An account with this email already exists. Sign in instead." : error.message.includes("ashoka") ? `Use your @${STUDENT_EMAIL_DOMAIN} email address.` : error.message };
        return { confirm: !data.session };
      },
      signIn: async (email, password) => {
        if (!isAshokaEmail(email)) return { error: `Use your @${STUDENT_EMAIL_DOMAIN} email address.` };
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (!error) return {};
        return { error: /confirm/i.test(error.message) ? "Confirm your email first. Check your inbox for the link we sent." : "Wrong email or password." };
      },
      signOut: async () => { await supabase.auth.signOut(); },

      getEvent: (id) => events.find((e) => e.id === id),
      getStats: (id): EventStats => stats[id] ?? { sold: 0, revenue: 0, checkedIn: 0, pending: 0, capacity: events.find((e) => e.id === id)?.capacity },
      salesState: salesStateOf,
      myTickets: () => tickets,

      submitPayment: async (eventId, file) => {
        if (!user) return { ok: false, reason: "Please sign in first." };
        if (!file.type.startsWith("image/")) return { ok: false, reason: "Upload a screenshot image (JPG or PNG)." };
        if (file.size > 20 * 1024 * 1024) return { ok: false, reason: "That image is too large. Choose a smaller screenshot." };
        const small = await shrink(file);
        if (small.size > MAX_SCREENSHOT_BYTES - 200_000) return { ok: false, reason: "That screenshot is still too large. Take a fresh screenshot and try again." };
        const form = new FormData();
        form.set("eventId", eventId);
        form.set("screenshot", small);
        try {
          await api("/api/orders", { method: "POST", body: form });
        } catch (e) {
          return { ok: false, reason: (e as Error).message };
        }
        await loadAll(true);
        return { ok: true };
      },

      createEvent: async (input, poster) => {
        const form = new FormData();
        form.set("name", input.name); form.set("description", input.description); form.set("date", input.date);
        form.set("time", input.time); form.set("venue", input.venue); form.set("price", String(input.price));
        form.set("capacity", input.capacity === undefined ? "" : String(input.capacity));
        form.set("salesOpen", input.salesOpen); form.set("salesClose", input.salesClose);
        if (poster) form.set("poster", poster);
        const r = await api("/api/events", { method: "POST", body: form });
        await loadAll(true);
        return r.id as string;
      },

      loadEvent,
      attendees: (id) => att[id] ?? [],
      pendingPayments: (id) => pend[id] ?? [],
      reviewPayment: async (orderId, approve, reason) => {
        let r: any;
        try {
          r = await api(`/api/organiser/payments/${orderId}/review`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approve, reason: reason ?? null }),
          });
        } catch (e) {
          return { error: (e as Error).message };
        }
        const evId = Object.keys(pend).find((k) => pend[k].some((p) => p.order.id === orderId));
        await loadAll(true);
        if (evId) await loadEvent(evId);
        const who = r.to ? ` (${r.to})` : "";
        const notice =
          r.email === "sent" ? (approve ? `Approved. The ticket was emailed to the student${who}.` : `Rejected. The student${who} was emailed the reason.`)
          : r.email === "not_configured" ? (approve ? "Approved. Email isn't set up yet, so the student opens the ticket in My tickets." : "Rejected. Email isn't set up yet, so the student sees the reason in My tickets.")
          : r.email === "failed" ? (approve ? "Approved, but the email couldn't be sent. Use \"Resend\" in the attendee list, or the student can open the ticket in My tickets." : "Rejected, but the email couldn't be sent. The student sees the reason in My tickets.")
          : undefined;
        return { notice };
      },
      resendTicketEmail: async (orderId) => {
        try {
          const r = await api(`/api/organiser/payments/${orderId}/resend`, { method: "POST" });
          return `Ticket emailed again${r.to ? ` to ${r.to}` : ""}.`;
        } catch (e) {
          return (e as Error).message;
        }
      },
      screenshotUrl: async (path) => path || null,

      // The database decides valid / used / wrong event / invalid. The scanner page only displays the result.
      checkIn: async (token, eventId): Promise<CheckInResult> => {
        try {
          const r = await api("/api/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, eventId }) });
          loadAll(true);
          const blank = { orderId: "", userId: "", eventId, token: "", status: "used" as const, createdAt: "" };
          if (r.kind === "valid") return { kind: "valid", name: r.name, ticket: { ...blank, id: r.ticketId } };
          if (r.kind === "used") return { kind: "used", name: r.name, at: r.at ?? "", ticket: { ...blank, id: "" } };
          if (r.kind === "wrong_event") return { kind: "wrong_event", name: r.name, eventName: r.eventName ?? "another event" };
        } catch { /* falls through to invalid */ }
        return { kind: "invalid" };
      },

      listUsers: async (search) => {
        try { return (await api(`/api/organiser/team?q=${encodeURIComponent(search)}`)).users.map(userFrom); } catch { return []; }
      },
      setUserRole: async (email, role) => {
        try {
          await api("/api/organiser/team/role", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) });
          return null;
        } catch (e) { return (e as Error).message; }
      },

      exportAttendees: async (eventId) => {
        try {
          const res = await fetch(`/api/organiser/events/${eventId}/export`, { headers: await authHeader() });
          if (!res.ok) return (await res.json().catch(() => null))?.error?.message ?? "We couldn't build the export.";
          const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "attendees.csv";
          downloadBlob(await res.blob(), name);
          return null;
        } catch {
          return "Can't reach the server. Check your connection and try again.";
        }
      },
    };
  }, [ready, user, events, tickets, orders, stats, att, pend, loadAll]);

  const value = useMemo(() => (ready ? store : ({ ready: false } as unknown as Store)), [ready, store]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
