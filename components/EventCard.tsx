"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, Heart, MapPin } from "lucide-react";
import Poster from "./Poster";
import type { EventT } from "@/lib/types";
import { formatINR, formatShortDate, formatTime } from "@/lib/format";

/** Event card: poster with price tab, favourite heart, name, one-line blurb, date, time and venue. Never shows seat counts. */
export default function EventCard({ event, soldOut = false, href }: { event: EventT; soldOut?: boolean; href?: string }) {
  const [liked, setLiked] = useState(false);
  return (
    <div className="relative">
      <Link href={href ?? `/events/${event.id}`} className="group block rounded-[32px] bg-white/60 p-2.5 pb-5 backdrop-blur transition-colors hover:bg-white/90">
        <div className="relative aspect-[4/3.2] overflow-hidden rounded-[26px]">
          <div className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"><Poster event={event} /></div>
          <p className="absolute bottom-0 right-0 rounded-tl-[22px] bg-accent px-5 py-2.5 text-lg font-medium">{formatINR(event.price)}</p>
          {soldOut && <span className="chip absolute right-3 top-3 bg-ink text-white">Sales closed</span>}
        </div>
        <div className="px-3">
          <h3 className="mt-4 text-2xl font-medium leading-tight">{event.name}</h3>
          <p className="mt-1.5 line-clamp-2 text-muted">{event.description.split("\n")[0]}</p>
          <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
            <div className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-muted" aria-hidden /><dt className="sr-only">Date</dt><dd>{formatShortDate(event.date)}</dd></div>
            <div className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-muted" aria-hidden /><dt className="sr-only">Time</dt><dd>{formatTime(event.time)}</dd></div>
            <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-muted" aria-hidden /><dt className="sr-only">Venue</dt><dd>{event.venue}</dd></div>
          </dl>
        </div>
      </Link>
      <button
        onClick={() => setLiked(!liked)}
        aria-pressed={liked}
        aria-label={liked ? "Remove from saved" : "Save event"}
        className={`absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full ${liked ? "bg-heart text-white" : "bg-ink text-white"}`}
      >
        <Heart className="h-5 w-5" fill={liked ? "currentColor" : "none"} aria-hidden />
      </button>
    </div>
  );
}
