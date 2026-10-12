"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays, ChevronLeft, Clock, Heart, MapPin, Share2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { MAX_TICKETS_PER_EVENT } from "@/lib/config";
import { formatDateTime, formatINR, formatShortDate, formatTime } from "@/lib/format";
import Poster from "@/components/Poster";
import { PageSkeleton } from "@/components/RequireRole";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { ready, user, getEvent, salesState, tickets } = useStore();
  const [liked, setLiked] = useState(false);
  const [shared, setShared] = useState(false);
  if (!ready) return <PageSkeleton />;

  const event = getEvent(id);
  if (!event) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-3xl font-semibold">We couldn't find that event</h1>
        <p className="mt-3 text-muted">It may have been removed, or the link is wrong.</p>
        <Link href="/" className="btn btn-dark mt-6">Back to events</Link>
      </div>
    );
  }

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: event.name, url });
      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 2000); }
    } catch { /* share was cancelled */ }
  };

  const state = salesState(event);
  const mine = user ? tickets.filter((t) => t.eventId === event.id && t.userId === user.id) : [];
  const atLimit = mine.length >= MAX_TICKETS_PER_EVENT;
  const [lead, ...more] = event.description.split("\n").filter(Boolean);

  let action: React.ReactNode;
  let note: React.ReactNode = null;
  if (user?.role === "organiser") {
    action = <button className="btn btn-outline btn-lg flex-1" disabled>Buy ticket</button>;
    note = <p className="text-sm text-muted">You're signed in as an organiser. Tickets are bought with a student account.</p>;
  } else if (state === "upcoming") {
    action = <button className="btn btn-outline btn-lg flex-1" disabled>Sales not open yet</button>;
    note = <p className="text-sm text-muted">Ticket sales open on {formatDateTime(event.salesOpen)}.</p>;
  } else if (state !== "open") {
    action = <button className="btn btn-outline btn-lg flex-1" disabled>Sales closed</button>;
  } else if (atLimit && mine[0]) {
    action = <Link href={`/tickets/${mine[0].id}`} className="btn btn-dark btn-lg flex-1">View your ticket</Link>;
    note = <p className="text-sm font-medium text-good">You already have a ticket for this event.</p>;
  } else if (!user) {
    action = <Link href={`/login?next=${encodeURIComponent(`/checkout/${event.id}`)}`} className="btn btn-primary btn-lg flex-1">Sign in to buy ticket</Link>;
  } else {
    action = <Link href={`/checkout/${event.id}`} className="btn btn-primary btn-lg flex-1">Buy ticket</Link>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative aspect-[4/3.3] overflow-hidden rounded-[32px]">
        <Poster event={event} />
        <Link href="/" aria-label="Back to events" className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/70 backdrop-blur hover:bg-white">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
      </div>

      <div className="relative -mt-10 rounded-[32px] bg-white p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium leading-tight sm:text-4xl">{event.name}</h1>
            <p className="mt-2 text-muted">{lead}</p>
          </div>
          <button onClick={share} aria-label="Share event" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-black/5 hover:bg-black/10">
            <Share2 className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {shared && <p role="status" className="mt-2 text-sm font-medium text-good">Link copied</p>}

        <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
          <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-muted" aria-hidden /><dt className="sr-only">Date</dt><dd>{formatShortDate(event.date)}</dd></div>
          <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-muted" aria-hidden /><dt className="sr-only">Time</dt><dd>{formatTime(event.time)}</dd></div>
          <div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-muted" aria-hidden /><dt className="sr-only">Venue</dt><dd>{event.venue}</dd></div>
        </dl>

        <div className="mt-6 flex items-end justify-between gap-4 border-t border-line pt-5">
          <p className={`flex items-center gap-2 text-sm font-medium ${state === "open" ? "text-good" : "text-muted"}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${state === "open" ? "bg-good" : "bg-muted"}`} aria-hidden />
            {state === "open" ? "Tickets available" : "Sales closed"}
          </p>
          <div className="text-right">
            <p className="text-sm text-muted">One ticket admits one person</p>
            <p className="text-4xl font-medium">{formatINR(event.price)}</p>
          </div>
        </div>

        {more.length > 0 && (
          <section className="mt-6 space-y-3 leading-relaxed text-ink/80" aria-label="About this event">
            {more.map((p, i) => <p key={i}>{p}</p>)}
          </section>
        )}
        {note && <div className="mt-5">{note}</div>}
      </div>

      <div className="sticky z-20 mt-5 flex gap-3" style={{ bottom: "calc(5.75rem + env(safe-area-inset-bottom, 0px))" }}>
        <button
          onClick={() => setLiked(!liked)}
          aria-pressed={liked}
          aria-label={liked ? "Remove from saved" : "Save event"}
          className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${liked ? "bg-heart text-white" : "bg-white text-heart"}`}
        >
          <Heart className="h-6 w-6" fill="currentColor" aria-hidden />
        </button>
        {action}
      </div>
    </div>
  );
}
