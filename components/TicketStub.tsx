"use client";

import { QRCodeSVG } from "qrcode.react";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import type { EventT, Ticket, User } from "@/lib/types";
import { formatClock, formatLongDate, formatTime } from "@/lib/format";

/**
 * The ticket. The QR encodes only the random token, never name/email (plan 4.3).
 * The perforation is real structure: the top half is the pass, the bottom half is the stub that gets scanned.
 */
export default function TicketStub({ ticket, event, user }: { ticket: Ticket; event: EventT; user: User }) {
  const used = ticket.status === "used";
  return (
    <article className="mx-auto w-full max-w-sm" aria-label={`Ticket for ${event.name}`}>
      <div className="rounded-t-[28px] bg-ink p-6 text-white">
        <div className="flex items-center justify-between">
          <span className={`chip ${used ? "bg-white/20 text-white" : "bg-accent text-ink"}`}>
            {used ? "Used" : "Active"}
          </span>
          <span className="font-mono text-xs tracking-wider text-white/80">{ticket.id}</span>
        </div>
        <h1 className="mt-4 text-3xl font-semibold leading-[1.05]">{event.name}</h1>
        <dl className="mt-5 space-y-2 text-[15px] text-white/90">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            <dt className="sr-only">Date</dt>
            <dd>{formatLongDate(event.date)}</dd>
          </div>
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 shrink-0" aria-hidden />
            <dt className="sr-only">Time</dt>
            <dd>{formatTime(event.time)}</dd>
          </div>
          <div className="flex items-center gap-2.5">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            <dt className="sr-only">Venue</dt>
            <dd>{event.venue}</dd>
          </div>
        </dl>
        <p className="mt-5 text-sm text-white/70">Admit one</p>
        <p className="text-lg font-semibold">{user.name}</p>
      </div>

      {/* perforation */}
      <div className="relative h-0">
        <span className="absolute -left-3 top-0 h-6 w-6 -translate-y-1/2 rounded-full bg-[#EBF1F4]" aria-hidden />
        <span className="absolute -right-3 top-0 h-6 w-6 -translate-y-1/2 rounded-full bg-[#EBF1F4]" aria-hidden />
      </div>

      <div className="rounded-b-[28px] border-x-2 border-b-2 border-black/10 bg-white px-6 pb-6 pt-8">
        <div className="relative mx-auto w-fit">
          <div className={used ? "opacity-20" : ""}>
            <QRCodeSVG value={ticket.token} size={208} level="M" marginSize={0} fgColor="#151515" />
          </div>
          {used && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="rotate-[-8deg] rounded-xl border-4 border-warn bg-white px-4 py-2 text-center">
                <p className="text-xl font-semibold text-warn-ink">Already used</p>
                {ticket.checkedInAt && <p className="text-sm font-semibold text-warn-ink">Scanned at {formatClock(ticket.checkedInAt)}</p>}
              </div>
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          {used ? "This ticket has been checked in." : "Show this code at the gate. Turn your screen brightness up."}
        </p>
      </div>
    </article>
  );
}
