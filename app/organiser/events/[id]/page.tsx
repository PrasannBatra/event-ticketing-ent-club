"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, ScanLine, Search } from "lucide-react";
import type { PendingPayment } from "@/lib/types";
import { useStore } from "@/lib/store";
import RequireRole from "@/components/RequireRole";
import { formatClock, formatDate, formatDateTime, formatINR, formatTime } from "@/lib/format";

function PaymentRow({ p, onDecide }: { p: PendingPayment; onDecide: (orderId: string, approve: boolean, reason?: string) => Promise<string | null> }) {
  const { screenshotUrl } = useStore();
  const [url, setUrl] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    screenshotUrl(p.order.screenshotPath).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [p.order.screenshotPath, screenshotUrl]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    setErr(await onDecide(p.order.id, approve, reason));
    setBusy(false);
  };

  return (
    <li className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
      <a href={url ?? undefined} target="_blank" rel="noreferrer" className="block h-40 w-full shrink-0 overflow-hidden rounded-2xl bg-paper sm:w-32" aria-label={`Open ${p.user.name}'s payment screenshot`}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Payment screenshot from ${p.user.name}`} className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full place-items-center px-2 text-center text-xs text-muted">{p.order.screenshotPath === "demo" ? "No image in demo data" : "Loading…"}</span>
        )}
      </a>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-medium">{p.user.name}</p>
        <p className="text-sm text-muted">{p.user.email} · {p.user.studentId}</p>
        <p className="mt-1 text-sm">Expected amount: <b>{formatINR(p.order.amount)}</b> · sent {formatDateTime(p.order.createdAt)}</p>
        {rejecting ? (
          <div className="mt-3 space-y-2">
            <label htmlFor={`r-${p.order.id}`} className="sr-only">Reason for rejecting</label>
            <input id={`r-${p.order.id}`} className="input" placeholder="Reason, e.g. amount doesn't match" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn btn-dark !py-2" disabled={busy} onClick={() => decide(false)}>Confirm reject</button>
              <button className="btn btn-outline !py-2" disabled={busy} onClick={() => setRejecting(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary !py-2" disabled={busy} onClick={() => decide(true)}>Approve</button>
            <button className="btn btn-outline !py-2" disabled={busy} onClick={() => setRejecting(true)}>Reject</button>
          </div>
        )}
        {err && <p role="alert" className="mt-2 text-sm font-medium text-bad">{err}</p>}
      </div>
    </li>
  );
}

function EventDashboard() {
  const { id } = useParams<{ id: string }>();
  const { user, getEvent, getStats, attendees, salesState, loadEvent, pendingPayments, reviewPayment, resendTicketEmail, exportAttendees } = useStore();
  const [notice, setNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(50);

  useEffect(() => { loadEvent(id); }, [id, loadEvent]);

  const event = getEvent(id);
  const all = useMemo(() => (event ? attendees(event.id) : []), [event, attendees]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return all;
    return all.filter((a) => a.user.name.toLowerCase().includes(s) || a.user.email.toLowerCase().includes(s) || a.ticket.id.toLowerCase().includes(s));
  }, [all, q]);

  // Organisers can only open events they created (plan 5.3).
  if (!event || event.organiserId !== user?.id) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-3xl font-semibold">Event not found</h1>
        <p className="mt-3 text-muted">It doesn't exist, or it belongs to another organiser.</p>
        <Link href="/organiser" className="btn btn-dark mt-6">Back to your events</Link>
      </div>
    );
  }

  const s = getStats(event.id);
  const state = salesState(event);
  const stateLabel = { open: "On sale", upcoming: "Opens " + formatDateTime(event.salesOpen), closed: "Sales closed", soldout: "Sold out" }[state];
  const pct = event.capacity ? Math.min(100, Math.round((s.sold / event.capacity) * 100)) : 0;

  const decide = async (orderId: string, approve: boolean, reason?: string) => {
    const r = await reviewPayment(orderId, approve, reason);
    if (r.notice) setNotice(r.notice);
    return r.error ?? null;
  };

  const exportCsv = async () => {
    setExportError(await exportAttendees(event.id));
  };

  return (
    <div>
      <Link href="/organiser" className="text-sm font-semibold text-muted hover:text-ink">All events</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{event.name}</h1>
          <p className="mt-2 text-muted">{formatDate(event.date)}, {formatTime(event.time)} at {event.venue}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportCsv} className="btn btn-outline"><Download className="h-4 w-4" aria-hidden /> Export CSV</button>
          <Link href={`/organiser/scan?event=${event.id}`} className="btn btn-primary"><ScanLine className="h-4 w-4" aria-hidden /> Scan tickets</Link>
        </div>
      </div>

      {exportError && <p role="alert" className="mt-4 rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">{exportError}</p>}

      <section className="mt-8 rounded-3xl bg-ink p-6 text-white sm:p-8" aria-label="Sales summary">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 sm:divide-x sm:divide-white/15">
          <div className="sm:pr-6"><dd className="text-5xl font-semibold">{s.sold}</dd><dt className="mt-1 text-sm text-white/70">Tickets sold</dt></div>
          <div className="sm:px-6"><dd className="text-5xl font-semibold">{formatINR(s.revenue)}</dd><dt className="mt-1 text-sm text-white/70">Revenue</dt></div>
          <div className="sm:px-6"><dd className="text-5xl font-semibold">{s.checkedIn}</dd><dt className="mt-1 text-sm text-white/70">Checked in</dt></div>
          <div className="sm:pl-6">
            <dd className="text-5xl font-semibold">{s.remaining ?? "No limit"}</dd>
            <dt className="mt-1 text-sm text-white/70">{s.remaining !== undefined ? "Capacity remaining" : "Capacity"}</dt>
          </div>
        </dl>
        {event.capacity !== undefined && (
          <div className="mt-8">
            <div className="h-3 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Capacity sold">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-sm text-white/70">{s.sold} of {event.capacity} sold. Students only see "tickets available" or "sales closed".</p>
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-x-10 gap-y-3 rounded-3xl bg-white p-6 text-sm sm:grid-cols-4" aria-label="Ticket configuration">
        <div><p className="text-muted">Status</p><p className="font-semibold">{stateLabel}</p></div>
        <div><p className="text-muted">Price</p><p className="font-semibold">{formatINR(event.price)}</p></div>
        <div><p className="text-muted">Sales open</p><p className="font-semibold">{formatDateTime(event.salesOpen)}</p></div>
        <div><p className="text-muted">Sales close</p><p className="font-semibold">{formatDateTime(event.salesClose)}</p></div>
      </section>

      {notice && <p role="status" className="mt-6 rounded-xl bg-good-soft px-4 py-3 text-sm font-medium text-good">{notice}</p>}

      <section className="mt-10" aria-labelledby="payments">
        <h2 id="payments" className="text-2xl font-semibold">Payments to review <span className="text-muted">({pendingPayments(event.id).length})</span></h2>
        <p className="mt-1 text-sm text-muted">Check the amount and transaction ID against your bank or UPI statement. Approving issues the student's QR ticket.</p>
        {pendingPayments(event.id).length === 0 ? (
          <p className="mt-4 rounded-3xl bg-white p-8 text-center text-muted">No payments waiting for review.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-3xl bg-white">
            {pendingPayments(event.id).map((p) => <PaymentRow key={p.order.id} p={p} onDecide={decide} />)}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="attendees">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="attendees" className="text-2xl font-semibold">Attendees <span className="text-muted">({rows.length})</span></h2>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor="search" className="sr-only">Search attendees</label>
            <input id="search" className="input !pl-11" placeholder="Search name, email or ticket ID" value={q} onChange={(e) => { setQ(e.target.value); setLimit(50); }} />
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="mt-6 rounded-3xl bg-white p-10 text-center text-muted">{all.length === 0 ? "No tickets sold yet." : "No attendees match your search."}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-3xl bg-white">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Ticket ID</th>
                  <th className="px-5 py-3 font-semibold">Payment</th>
                  <th className="px-5 py-3 font-semibold">Check-in</th>
                  <th className="px-5 py-3 font-semibold"><span className="sr-only">Ticket email</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, limit).map((a) => (
                  <tr key={a.ticket.id}>
                    <td className="px-5 py-3"><p className="font-semibold">{a.user.name}</p><p className="text-xs text-muted">{a.user.studentId}</p></td>
                    <td className="px-5 py-3 text-muted">{a.user.email}</td>
                    <td className="px-5 py-3 font-mono text-xs">{a.ticket.id}</td>
                    <td className="px-5 py-3"><span className="chip bg-good-soft text-good">Verified</span></td>
                    <td className="px-5 py-3">
                      {a.ticket.status === "used"
                        ? <span className="chip bg-ultra-soft text-ultra-dark">Checked in {a.ticket.checkedInAt && formatClock(a.ticket.checkedInAt)}</span>
                        : <span className="chip bg-line text-muted">Not yet</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button className="text-sm font-semibold text-ultra underline-offset-4 hover:underline" onClick={async () => setNotice(await resendTicketEmail(a.ticket.orderId))}>Resend ticket email</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > limit && (
          <button onClick={() => setLimit(limit + 50)} className="btn btn-outline mt-4">Show more</button>
        )}
      </section>
    </div>
  );
}

export default function EventDashboardPage() {
  return (
    <RequireRole role="organiser">
      <EventDashboard />
    </RequireRole>
  );
}
