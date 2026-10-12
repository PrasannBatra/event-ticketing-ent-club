"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import RequireRole from "@/components/RequireRole";
import Poster from "@/components/Poster";
import { eventStart, formatDate, formatTime } from "@/lib/format";

function MyTickets() {
  const { myTickets, getEvent } = useStore();
  const rows = myTickets()
    .map((t) => ({ t, e: getEvent(t.eventId) }))
    .filter((r): r is { t: typeof r.t; e: NonNullable<typeof r.e> } => !!r.e)
    .sort((a, b) => eventStart(a.e) - eventStart(b.e));

  const active = rows.filter((r) => r.t.status === "active");
  const used = rows.filter((r) => r.t.status === "used");

  const Row = ({ t, e }: (typeof rows)[number]) => (
    <li>
      <Link href={`/tickets/${t.id}`} className="flex items-center gap-4 rounded-3xl bg-white p-3 pr-5 transition-colors hover:bg-ultra-soft">
        <div className="h-20 w-16 shrink-0 overflow-hidden rounded-2xl sm:h-24 sm:w-20"><Poster event={e} /></div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold">{e.name}</h3>
          <p className="text-sm text-muted">{formatDate(e.date)}, {formatTime(e.time)}</p>
          <p className="text-sm text-muted">{e.venue}</p>
        </div>
        <span className={`chip ${t.status === "active" ? "bg-good-soft text-good" : "bg-warn-soft text-warn-ink"}`}>
          {t.status === "active" ? "Active" : "Used"}
        </span>
        <ChevronRight className="h-5 w-5 text-muted" aria-hidden />
      </Link>
    </li>
  );

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-3xl font-semibold">No tickets yet</h1>
        <p className="mt-3 text-muted">Tickets you buy show up here, ready to open at the gate.</p>
        <Link href="/" className="btn btn-primary mt-6">Browse events</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-4xl font-semibold">My tickets</h1>
      {active.length > 0 && <ul className="mt-6 space-y-3">{active.map((r) => <Row key={r.t.id} {...r} />)}</ul>}
      {used.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-xl font-semibold text-muted">Used</h2>
          <ul className="space-y-3">{used.map((r) => <Row key={r.t.id} {...r} />)}</ul>
        </>
      )}
    </div>
  );
}

export default function TicketsPage() {
  return (
    <RequireRole role="student">
      <MyTickets />
    </RequireRole>
  );
}
