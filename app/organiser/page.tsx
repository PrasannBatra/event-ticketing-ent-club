"use client";

import Link from "next/link";
import { PlusCircle, ScanLine } from "lucide-react";
import { useStore } from "@/lib/store";
import RequireRole from "@/components/RequireRole";
import Poster from "@/components/Poster";
import { eventStart, formatDate, formatINR, formatTime } from "@/lib/format";
import type { SalesState } from "@/lib/types";

const stateChip: Record<SalesState, { label: string; cls: string }> = {
  open: { label: "On sale", cls: "bg-good-soft text-good" },
  upcoming: { label: "Opens soon", cls: "bg-ultra-soft text-ultra-dark" },
  closed: { label: "Sales closed", cls: "bg-line text-muted" },
  soldout: { label: "Sold out", cls: "bg-warn-soft text-warn-ink" },
};

function Dashboard() {
  const { user, events, getStats, salesState } = useStore();
  // Organisers only see events they created (plan 5.3).
  const mine = events.filter((e) => e.organiserId === user?.id).sort((a, b) => eventStart(a) - eventStart(b));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold sm:text-5xl">Your events</h1>
          <p className="mt-2 text-muted">Sales, attendees and check-in for every event you run.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/organiser/scan" className="btn btn-outline"><ScanLine className="h-4 w-4" aria-hidden /> Scan tickets</Link>
          <Link href="/organiser/events/new" className="btn btn-primary"><PlusCircle className="h-4 w-4" aria-hidden /> New event</Link>
        </div>
      </div>

      {mine.length === 0 ? (
        <div className="mx-auto max-w-md py-24 text-center">
          <h2 className="text-2xl font-semibold">You haven't created an event yet</h2>
          <p className="mt-3 text-muted">Events go live as soon as you create them. Students can buy once sales open.</p>
          <Link href="/organiser/events/new" className="btn btn-primary mt-6">Create your first event</Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line overflow-hidden rounded-3xl bg-white">
          {mine.map((e) => {
            const s = getStats(e.id);
            const st = stateChip[salesState(e)];
            return (
              <li key={e.id}>
                <Link href={`/organiser/events/${e.id}`} className="flex flex-col gap-4 p-4 transition-colors hover:bg-ultra-soft/60 sm:flex-row sm:items-center sm:p-5">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="h-20 w-16 shrink-0 overflow-hidden rounded-2xl"><Poster event={e} /></div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-xl font-semibold">{e.name}</h2>
                        <span className={`chip ${st.cls}`}>{st.label}</span>
                      </div>
                      <p className="text-sm text-muted">{formatDate(e.date)}, {formatTime(e.time)} at {e.venue}</p>
                      <p className="text-sm text-muted">{formatINR(e.price)} per ticket</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-3 gap-6 text-center sm:w-72">
                    <div><dd className="text-2xl font-semibold">{s.sold}</dd><dt className="text-xs text-muted">Sold</dt></div>
                    <div><dd className="text-2xl font-semibold">{formatINR(s.revenue)}</dd><dt className="text-xs text-muted">Revenue</dt></div>
                    <div><dd className="text-2xl font-semibold">{s.checkedIn}</dd><dt className="text-xs text-muted">Checked in</dt></div>
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function OrganiserHome() {
  return (
    <RequireRole role="organiser">
      <Dashboard />
    </RequireRole>
  );
}
