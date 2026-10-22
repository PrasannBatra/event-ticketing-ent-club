"use client";

/**
 * Demo backend: the same Store contract as the Supabase version, but everything lives in the
 * browser (localStorage) on sample data. Used automatically when the Supabase env vars are missing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAX_TICKETS_PER_EVENT, isAshokaEmail } from "./config";
import { buildSeed, DEMO_ORGANISER_ID, DEMO_STUDENT_ID, type DB } from "./seed";
import { Ctx, MAX_SCREENSHOT_BYTES, ORDER_ERRORS, downloadBlob, salesStateOf, type Store } from "./store-context";
import type { Attendee, CheckInResult, EventStats, EventT, Order, PendingPayment, Ticket, User } from "./types";

const KEY = "gatepass-demo-v4";
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const rid = (len: number) => {
  const b = new Uint32Array(len);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => ALPHA[x % ALPHA.length]).join("");
};
const readFile = (f: File) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => res(""); r.readAsDataURL(f); });

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);
  const ref = useRef<DB | null>(null);
  const commit = useCallback((n: DB) => { ref.current = n; setDb(n); }, []);

  useEffect(() => {
    let initial: DB | null = null;
    try { const raw = localStorage.getItem(KEY); if (raw) initial = JSON.parse(raw) as DB; } catch { initial = null; }
    commit(initial ?? buildSeed());
  }, [commit]);

  useEffect(() => {
    if (!db) return;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage full: demo keeps working in memory */ }
  }, [db]);

  const store = useMemo<Store | null>(() => {
    if (!db) return null;
    const cur = () => ref.current as DB;
    const user = db.users.find((u) => u.id === db.currentUserId) ?? null;

    const counts = (d: DB, eventId: string) => ({
      sold: d.tickets.filter((t) => t.eventId === eventId).length,
      pending: d.orders.filter((o) => o.eventId === eventId && o.paymentStatus === "awaiting_review").length,
    });
    const events: EventT[] = db.events.map((e) => {
      const c = counts(db, e.id);
      return { ...e, soldOut: e.capacity !== undefined && c.sold + c.pending >= e.capacity };
    });
    const withFlag = (e: EventT): EventT => events.find((x) => x.id === e.id) ?? e;

    const getStats = (eventId: string): EventStats => {
      const d = cur();
      const ev = d.events.find((e) => e.id === eventId);
      const ts = d.tickets.filter((t) => t.eventId === eventId);
      const c = counts(d, eventId);
      return {
        sold: ts.length,
        revenue: d.orders.filter((o) => o.eventId === eventId && o.paymentStatus === "approved").reduce((s, o) => s + o.amount, 0),
        checkedIn: ts.filter((t) => t.status === "used").length,
        pending: c.pending,
        capacity: ev?.capacity,
        remaining: ev?.capacity !== undefined ? Math.max(ev.capacity - c.sold - c.pending, 0) : undefined,
      };
    };

    const attendees = (eventId: string): Attendee[] => {
      const d = cur();
      return d.tickets.filter((t) => t.eventId === eventId)
        .map((t) => ({ ticket: t, user: d.users.find((u) => u.id === t.userId) as User, order: d.orders.find((o) => o.id === t.orderId) }))
        .filter((a) => a.user).sort((a, b) => a.user.name.localeCompare(b.user.name));
    };

    const store: Store = {
      ready: true,
      demo: true,
      user,
      events,
      tickets: db.tickets.filter((t) => t.userId === user?.id),
      orders: db.orders.filter((o) => o.userId === user?.id),

      signUp: async ({ name, email }) => {
        const d = cur();
        const e = email.trim().toLowerCase();
        if (!isAshokaEmail(e)) return { error: "Use your @ashoka.edu.in email address." };
        if (d.users.some((u) => u.email === e)) return { error: "An account with this email already exists. Sign in instead." };
        const u: User = { id: "stu-" + rid(6), name: name.trim(), email: e, studentId: "", role: "student", createdAt: new Date().toISOString() };
        commit({ ...d, users: [...d.users, u], currentUserId: u.id });
        return {};
      },
      signIn: async (email) => {
        const d = cur();
        const u = d.users.find((x) => x.email === email.trim().toLowerCase());
        if (!isAshokaEmail(email)) return { error: "Use your @ashoka.edu.in email address." };
        if (!u) return { error: "We can't find an account with that email. Create an account first." };
        commit({ ...d, currentUserId: u.id });
        return {};
      },
      signInWithGoogle: async () => ({ error: "Google sign-in isn't available in demo mode. Connect Supabase to use it." }),
      signOut: async () => commit({ ...cur(), currentUserId: null }),
      resendConfirmation: async () => ({}),
      requestPasswordReset: async (email) => (isAshokaEmail(email) ? {} : { error: "Use your @ashoka.edu.in email address." }),
      updatePassword: async (password) => (password.length < 8 ? { error: "Use a password with at least 8 characters." } : {}),
      signInDemo: (role) => commit({ ...cur(), currentUserId: role === "student" ? DEMO_STUDENT_ID : DEMO_ORGANISER_ID }),
      resetDemo: () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } commit(buildSeed()); },
      demoScanTokens: (eventId) => ({
        valid: cur().tickets.find((t) => t.eventId === eventId && t.status === "active")?.token,
        other: cur().tickets.find((t) => t.eventId !== eventId)?.token,
      }),

      getEvent: (id) => events.find((e) => e.id === id),
      getStats,
      salesState: (e) => salesStateOf(withFlag(e)),
      myTickets: () => cur().tickets.filter((t) => t.userId === user?.id),

      submitPayment: async (eventId, file) => {
        const d = cur();
        const me = d.users.find((u) => u.id === d.currentUserId);
        const ev = d.events.find((e) => e.id === eventId);
        if (!me) return { ok: false, reason: ORDER_ERRORS.not_signed_in };
        if (me.role !== "student") return { ok: false, reason: ORDER_ERRORS.not_student };
        if (!ev) return { ok: false, reason: ORDER_ERRORS.event_not_found };
        if (!file.type.startsWith("image/")) return { ok: false, reason: "Upload a screenshot image (JPG or PNG)." };
        if (file.size > MAX_SCREENSHOT_BYTES) return { ok: false, reason: "That image is over 5 MB. Choose a smaller screenshot." };
        const state = salesStateOf(events.find((e) => e.id === eventId) as EventT);
        if (state === "upcoming") return { ok: false, reason: ORDER_ERRORS.sales_not_open };
        if (state !== "open") return { ok: false, reason: ORDER_ERRORS.sales_closed };
        const live = d.orders.filter((o) => o.userId === me.id && o.eventId === eventId && o.paymentStatus !== "rejected").length;
        if (live >= MAX_TICKETS_PER_EVENT) return { ok: false, reason: ORDER_ERRORS.already_has_ticket };
        const img = await readFile(file);
        const order: Order = {
          id: "ord_" + rid(8), userId: me.id, eventId, amount: ev.price,
          screenshotPath: img.length < 400_000 ? img : "demo", paymentStatus: "awaiting_review", createdAt: new Date().toISOString(),
        };
        commit({ ...cur(), orders: [...cur().orders, order] });
        return { ok: true };
      },

      createEvent: async (input) => {
        const d = cur();
        const id = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + rid(3).toLowerCase();
        const ev: EventT = { ...input, id, posterTheme: input.name.length % 5, organiserId: d.currentUserId ?? DEMO_ORGANISER_ID, createdAt: new Date().toISOString() };
        commit({ ...d, events: [...d.events, ev] });
        return id;
      },
      loadEvent: async () => {},
      attendees,
      pendingPayments: (eventId): PendingPayment[] => {
        const d = cur();
        return d.orders.filter((o) => o.eventId === eventId && o.paymentStatus === "awaiting_review")
          .map((o) => ({
            order: o, user: d.users.find((u) => u.id === o.userId) as User,
            duplicates: o.screenshotPath === "demo" ? 0 : d.orders.filter((x) => x.id !== o.id && x.screenshotPath === o.screenshotPath).length,
          })).filter((p) => p.user);
      },
      reviewPayments: async (orderIds, approve, reason) => {
        let d = cur();
        let decided = 0, skipped = 0;
        for (const id of orderIds) {
          const o = d.orders.find((x) => x.id === id);
          if (!o || o.paymentStatus !== "awaiting_review") { skipped++; continue; }
          if (approve) {
            const t: Ticket = { id: "TKT-" + rid(5), orderId: id, userId: o.userId, eventId: o.eventId, token: rid(28), status: "active", createdAt: new Date().toISOString() };
            d = { ...d, orders: d.orders.map((x) => (x.id === id ? { ...x, paymentStatus: "approved", emailStatus: "pending" } : x)), tickets: [...d.tickets, t] };
          } else {
            d = { ...d, orders: d.orders.map((x) => (x.id === id ? { ...x, paymentStatus: "rejected", rejectReason: reason?.trim() || undefined, emailStatus: "pending" } : x)) };
          }
          decided++;
        }
        commit(d);
        return { decided, skipped };
      },
      sendEmails: async (eventId, opts) => {
        let sent = 0;
        const ids = cur().orders.filter((o) => o.eventId === eventId && o.emailStatus === "pending").map((o) => o.id);
        for (const id of ids) {
          await new Promise((r) => setTimeout(r, 140)); // pretend to send
          commit({ ...cur(), orders: cur().orders.map((o) => (o.id === id ? { ...o, emailStatus: "sent" } : o)) });
          sent++;
          opts?.onProgress?.({ sent, failed: 0, remaining: ids.length - sent });
        }
        return { sent, failed: 0, remaining: 0 };
      },
      emailStatus: (eventId) => ({ pending: cur().orders.filter((o) => o.eventId === eventId && o.emailStatus === "pending").length, failed: 0 }),
      resendTicketEmail: async () => "Demo mode: no email is sent.",
      exportAttendees: async (eventId) => {
        const ev = cur().events.find((e) => e.id === eventId);
        const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
        const rows = [["Name", "Email", "Student ID", "Ticket ID", "Event", "Payment status", "Purchase time", "Check-in status", "Check-in time"],
          ...attendees(eventId).map((a) => [a.user.name, a.user.email, a.user.studentId, a.ticket.id, ev?.name ?? "", "Verified", a.ticket.createdAt, a.ticket.status === "used" ? "Checked in" : "Not checked in", a.ticket.checkedInAt ?? ""])];
        downloadBlob(new Blob(["\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }), `${(ev?.name ?? "attendees").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-attendees.csv`);
        return null;
      },
      listUsers: async (search) => {
        const t = search.trim().toLowerCase();
        return cur().users.filter((u) => !t || u.name.toLowerCase().includes(t) || u.email.includes(t)).sort((a, b) => Number(a.role === "student") - Number(b.role === "student") || a.name.localeCompare(b.name)).slice(0, 50);
      },
      setUserRole: async (email, role) => {
        const d = cur();
        const target = d.users.find((u) => u.email === email.trim().toLowerCase());
        if (!target || target.id === d.currentUserId) return "We couldn't find that person (you can't change your own role).";
        commit({ ...d, users: d.users.map((u) => (u.id === target.id ? { ...u, role } : u)) });
        return null;
      },
      screenshotUrl: async (path) => (path.startsWith("data:") ? path : null),

      // One atomic update: the first scan wins, later scans report the first scan time.
      checkIn: async (token, eventId): Promise<CheckInResult> => {
        const d = cur();
        const t = d.tickets.find((x) => x.token === token.trim());
        if (!t) return { kind: "invalid" };
        const name = d.users.find((u) => u.id === t.userId)?.name ?? "Unknown";
        if (t.eventId !== eventId) return { kind: "wrong_event", eventName: d.events.find((e) => e.id === t.eventId)?.name ?? "another event", name };
        if (t.status === "used") return { kind: "used", ticket: t, name, at: t.checkedInAt ?? "" };
        const updated: Ticket = { ...t, status: "used", checkedInAt: new Date().toISOString(), checkedInBy: d.currentUserId ?? undefined };
        commit({ ...d, tickets: d.tickets.map((x) => (x.id === t.id ? updated : x)) });
        return { kind: "valid", ticket: updated, name };
      },
    };
    return store;
  }, [db, commit]);

  const fallback = useMemo(() => ({ ready: false } as unknown as Store), []);
  return <Ctx.Provider value={store ?? fallback}>{children}</Ctx.Provider>;
}
