"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, ScanLine, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import RequireRole from "@/components/RequireRole";
import { formatClock, formatDate, formatDateTime, formatINR, formatTime } from "@/lib/format";

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function EventDashboard() {
  const { id } = useParams<{ id: string }>();
  const { user, getEvent, getStats, attendees, salesState } = useStore();
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(50);

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

  const exportCsv = () => {
    const head = ["Name", "Email", "Student ID", "Ticket ID", "Event", "Payment status", "Purchase time", "Check-in status", "Check-in time"];
    const lines = all.map((a) => [
      a.user.name, a.user.email, a.user.studentId, a.ticket.id, event.name,
      a.order?.paymentStatus ?? "paid", a.ticket.createdAt,
      a.ticket.status === "used" ? "Checked in" : "Not checked in", a.ticket.checkedInAt ?? "",
    ].map(csvCell).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-attendees.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Ticket ID</th>
                  <th className="px-5 py-3 font-semibold">Payment</th>
                  <th className="px-5 py-3 font-semibold">Check-in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, limit).map((a) => (
                  <tr key={a.ticket.id}>
                    <td className="px-5 py-3"><p className="font-semibold">{a.user.name}</p><p className="text-xs text-muted">{a.user.studentId}</p></td>
                    <td className="px-5 py-3 text-muted">{a.user.email}</td>
                    <td className="px-5 py-3 font-mono text-xs">{a.ticket.id}</td>
                    <td className="px-5 py-3"><span className="chip bg-good-soft text-good">{(a.order?.paymentStatus ?? "paid") === "paid" ? "Paid" : a.order?.paymentStatus}</span></td>
                    <td className="px-5 py-3">
                      {a.ticket.status === "used"
                        ? <span className="chip bg-ultra-soft text-ultra-dark">Checked in {a.ticket.checkedInAt && formatClock(a.ticket.checkedInAt)}</span>
                        : <span className="chip bg-line text-muted">Not yet</span>}
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
