"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock, Heart, MapPin } from "lucide-react";
import Poster from "./Poster";
import type { EventT } from "@/lib/types";
import { formatINR, formatShortDate, formatTime } from "@/lib/format";

/** Event card: poster with the name over it, then date, time, venue, price and a Buy ticket button. Never shows seat counts. */
export default function EventCard({ event, soldOut = false, href }: { event: EventT; soldOut?: boolean; href?: string }) {
  const [liked, setLiked] = useState(false);
  return (
    <div className="relative">
      <Link href={href ?? `/events/${event.id}`} className="group block overflow-hidden rounded-[30px] border border-edge/60 bg-card/80 transition-colors hover:border-accent/70">
        <div className="relative aspect-[4/3.5] overflow-hidden">
          <div className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"><Poster event={event} /></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" aria-hidden />
          {soldOut && <span className="chip absolute right-4 top-4 bg-black/70 text-white">Sales closed</span>}
          <div className="absolute inset-x-0 bottom-0 p-5">
            <h3 className="font-display text-3xl font-medium leading-[1.05] text-white">{event.name}</h3>
            <p className="mt-1.5 line-clamp-1 text-sm text-white/75">{event.description.split("\n")[0]}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <dl className="min-w-0 space-y-1.5 text-sm text-muted">
            <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0" aria-hidden /><dt className="sr-only">When</dt><dd className="text-ink">{formatShortDate(event.date)}, {formatTime(event.time)}</dd></div>
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" aria-hidden /><dt className="sr-only">Where</dt><dd className="truncate">{event.venue}</dd></div>
            <div className="sr-only"><Clock aria-hidden /></div>
          </dl>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <p className="text-2xl font-medium">{formatINR(event.price)}</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">Buy ticket <ArrowRight className="h-4 w-4" aria-hidden /></span>
          </div>
        </div>
      </Link>
      <button
        onClick={() => setLiked(!liked)}
        aria-pressed={liked}
        aria-label={liked ? "Remove from saved" : "Save event"}
        className={`absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full backdrop-blur ${liked ? "bg-heart text-white" : "bg-black/45 text-white"}`}
      >
        <Heart className="h-5 w-5" fill={liked ? "currentColor" : "none"} aria-hidden />
      </button>
    </div>
  );
}
