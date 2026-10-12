"use client";

/**
 * Front-end data layer with in-browser demo data (persisted in localStorage).
 *
 * Every function below that is marked SERVER in a comment is business logic that
 * must live on the server in production (Next.js route handlers + Supabase), because
 * the plan requires that payments, capacity and check-in are never decided in the
 * browser. Here they run locally so the whole UI can be demoed end to end.
 * Swap each one for a fetch() to your API route and keep the return types.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MAX_TICKETS_PER_EVENT } from "./config";
import { buildSeed, DEMO_ORGANISER_ID, DEMO_STUDENT_ID, type DB } from "./seed";
import type {
  Attendee, CheckInResult, EventStats, EventT, NewEventInput, Order, Role, SalesState,
  StartOrderResult, Ticket, User,
} from "./types";

const KEY = "gatepass-demo-v1";
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomId(len: number): string {
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHA[b % ALPHA.length]).join("");
}

interface Store {
  ready: boolean;
  user: User | null;
  events: EventT[];
  tickets: Ticket[];
  signInWithEmail: (input: { email: string; name?: string; studentId?: string }) => User;
  emailExists: (email: string) => boolean;
  signInDemo: (role: Role) => void;
  signOut: () => void;
  resetDemo: () => void;
  getEvent: (id: string) => EventT | undefined;
  getUser: (id: string) => User | undefined;
  getStats: (eventId: string) => EventStats;
  salesState: (e: EventT) => SalesState;
  myTickets: () => Ticket[];
  createEvent: (input: NewEventInput) => string;
  startOrder: (eventId: string) => StartOrderResult;
  completePayment: (orderId: string, paid: boolean) => Ticket | null;
  checkIn: (token: string, eventId: string) => CheckInResult;
  attendees: (eventId: string) => Attendee[];
  getOrder: (id: string) => Order | undefined;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);
  const ref = useRef<DB | null>(null);

  const commit = useCallback((next: DB) => {
    ref.current = next;
    setDb(next);
  }, []);

  useEffect(() => {
    let initial: DB | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) initial = JSON.parse(raw) as DB;
    } catch {
      initial = null;
    }
    commit(initial ?? buildSeed());
  }, [commit]);

  useEffect(() => {
    if (!db) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      /* storage can be full or blocked; the demo still works in memory */
    }
  }, [db]);

  const store = useMemo<Store | null>(() => {
    if (!db) return null;
    const user = db.users.find((u) => u.id === db.currentUserId) ?? null;
    const cur = () => ref.current as DB;

    const salesState = (e: EventT): SalesState => {
      const now = Date.now();
      if (now < new Date(e.salesOpen).getTime()) return "upcoming";
      if (now > new Date(e.salesClose).getTime()) return "closed";
      if (e.capacity !== undefined && cur().tickets.filter((t) => t.eventId === e.id).length >= e.capacity) return "soldout";
      return "open";
    };

    const getStats = (eventId: string): EventStats => {
      const d = cur();
      const ev = d.events.find((e) => e.id === eventId);
      const ts = d.tickets.filter((t) => t.eventId === eventId);
      const revenue = d.orders
        .filter((o) => o.eventId === eventId && o.paymentStatus === "paid")
        .reduce((s, o) => s + o.amount, 0);
      return {
        sold: ts.length,
        revenue,
        checkedIn: ts.filter((t) => t.status === "used").length,
        capacity: ev?.capacity,
        remaining: ev?.capacity !== undefined ? Math.max(ev.capacity - ts.length, 0) : undefined,
      };
    };

    const signInWithEmail: Store["signInWithEmail"] = ({ email, name, studentId }) => {
      const d = cur();
      const e = email.trim().toLowerCase();
      let u = d.users.find((x) => x.email === e);
      if (!u) {
        // Self sign-up always creates a Student. Organisers are promoted manually (plan 4.1).
        u = {
          id: "stu-" + randomId(6),
          name: name?.trim() || e.split("@")[0].replace(/[._]/g, " "),
          email: e,
          studentId: studentId?.trim() || "",
          role: "student",
          createdAt: new Date().toISOString(),
        };
        commit({ ...d, users: [...d.users, u], currentUserId: u.id });
      } else {
        commit({ ...d, currentUserId: u.id });
      }
      return u;
    };

    return {
      ready: true,
      user,
      events: db.events,
      tickets: db.tickets,
      signInWithEmail,
      emailExists: (email) => cur().users.some((u) => u.email === email.trim().toLowerCase()),
      signInDemo: (role) =>
        commit({ ...cur(), currentUserId: role === "student" ? DEMO_STUDENT_ID : DEMO_ORGANISER_ID }),
      signOut: () => commit({ ...cur(), currentUserId: null }),
      resetDemo: () => {
        try { localStorage.removeItem(KEY); } catch { /* ignore */ }
        commit(buildSeed());
      },
      getEvent: (id) => cur().events.find((e) => e.id === id),
      getUser: (id) => cur().users.find((u) => u.id === id),
      getOrder: (id) => cur().orders.find((o) => o.id === id),
      getStats,
      salesState,
      myTickets: () => (user ? cur().tickets.filter((t) => t.userId === user.id) : []),

      createEvent: (input) => {
        const d = cur();
        const id = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + randomId(3).toLowerCase();
        const ev: EventT = {
          ...input,
          id,
          posterTheme: input.name.length % 5,
          organiserId: d.currentUserId ?? DEMO_ORGANISER_ID,
          createdAt: new Date().toISOString(),
        };
        commit({ ...d, events: [...d.events, ev] }); // no approval step: live once created (V1 rule 2)
        return id;
      },

      // SERVER: create the payment order. Capacity and sales window are checked here.
      startOrder: (eventId) => {
        const d = cur();
        const me = d.users.find((u) => u.id === d.currentUserId);
        const ev = d.events.find((e) => e.id === eventId);
        if (!me) return { ok: false, reason: "auth" };
        if (me.role !== "student") return { ok: false, reason: "role" };
        if (!ev) return { ok: false, reason: "missing" };
        const state = salesState(ev);
        if (state === "upcoming") return { ok: false, reason: "upcoming" };
        if (state !== "open") return { ok: false, reason: "closed" };
        const owned = d.tickets.filter((t) => t.eventId === eventId && t.userId === me.id).length;
        if (owned >= MAX_TICKETS_PER_EVENT) return { ok: false, reason: "limit" };
        const order: Order = {
          id: "ord_" + randomId(8),
          userId: me.id,
          eventId,
          amount: ev.price,
          paymentId: "pay_" + randomId(10),
          paymentStatus: "pending",
          createdAt: new Date().toISOString(),
        };
        commit({ ...d, orders: [...d.orders, order] });
        return { ok: true, order };
      },

      // SERVER: in production this is the verified gateway webhook, never the browser.
      // Idempotent: calling it twice for one order returns the same ticket.
      completePayment: (orderId, paid) => {
        const d = cur();
        const order = d.orders.find((o) => o.id === orderId);
        if (!order) return null;
        const existing = d.tickets.find((t) => t.orderId === orderId);
        if (existing) return existing;
        if (!paid) {
          commit({ ...d, orders: d.orders.map((o) => (o.id === orderId ? { ...o, paymentStatus: "failed" } : o)) });
          return null;
        }
        const ticket: Ticket = {
          id: "TKT-" + randomId(5),
          orderId,
          userId: order.userId,
          eventId: order.eventId,
          token: randomId(28),
          status: "active",
          createdAt: new Date().toISOString(),
        };
        commit({
          ...d,
          orders: d.orders.map((o) => (o.id === orderId ? { ...o, paymentStatus: "paid" } : o)),
          tickets: [...d.tickets, ticket],
        });
        return ticket;
      },

      // SERVER: one atomic update. The first scan wins; later scans report the first scan time.
      checkIn: (token, eventId) => {
        const d = cur();
        const t = d.tickets.find((x) => x.token === token.trim());
        if (!t) return { kind: "invalid" };
        const owner = d.users.find((u) => u.id === t.userId);
        const name = owner?.name ?? "Unknown";
        if (t.eventId !== eventId) {
          const other = d.events.find((e) => e.id === t.eventId);
          return { kind: "wrong_event", eventName: other?.name ?? "another event", name };
        }
        if (t.status === "used") return { kind: "used", ticket: t, name, at: t.checkedInAt ?? "" };
        const updated: Ticket = {
          ...t,
          status: "used",
          checkedInAt: new Date().toISOString(),
          checkedInBy: d.currentUserId ?? undefined,
        };
        commit({ ...d, tickets: d.tickets.map((x) => (x.id === t.id ? updated : x)) });
        return { kind: "valid", ticket: updated, name };
      },

      attendees: (eventId) => {
        const d = cur();
        return d.tickets
          .filter((t) => t.eventId === eventId)
          .map((t) => ({
            ticket: t,
            user: d.users.find((u) => u.id === t.userId) as User,
            order: d.orders.find((o) => o.id === t.orderId),
          }))
          .filter((a) => a.user)
          .sort((a, b) => a.user.name.localeCompare(b.user.name));
      },
    };
  }, [db, commit]);

  const fallback: Store = useMemo(
    () => ({ ready: false } as unknown as Store),
    [],
  );

  return <Ctx.Provider value={store ?? fallback}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}
