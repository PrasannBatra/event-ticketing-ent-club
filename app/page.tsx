"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { useStore } from "@/lib/store";
import { eventStart } from "@/lib/format";
import EventCard from "@/components/EventCard";
import { PageSkeleton } from "@/components/RequireRole";

export default function HomePage() {
  const { ready, user, events, salesState } = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cheapFirst, setCheapFirst] = useState(false);
  useEffect(() => { if (ready && user && user.role !== "student") router.replace("/organiser"); }, [ready, user, router]);
  if (!ready || (user && user.role !== "student")) return <PageSkeleton />;

  // Home lists events currently open for purchase (plan 2.2). Sold-out ones stay visible as "Sales closed".
  const term = q.trim().toLowerCase();
  const listed = events
    .filter((e) => ["open", "soldout"].includes(salesState(e)))
    .filter((e) => !term || e.name.toLowerCase().includes(term) || e.venue.toLowerCase().includes(term))
    .sort((a, b) => (cheapFirst ? a.price - b.price : eventStart(a) - eventStart(b)));

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-muted">{user ? `Hi ${user.name.split(" ")[0]}` : "Welcome"}</p>
      <h1 className="mb-6 mt-1 max-w-xl font-display text-4xl font-medium leading-[1.05] sm:text-5xl">Find your next night out on campus.</h1>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="find" className="sr-only">Find things to do</label>
          <input id="find" className="input !h-14 !rounded-full !pl-14 text-base" placeholder="Find things to do" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button
          onClick={() => setCheapFirst(!cheapFirst)}
          aria-pressed={cheapFirst}
          aria-label="Sort by lowest price"
          title="Sort by lowest price"
          className={`grid h-14 w-14 shrink-0 place-items-center rounded-full transition-colors ${cheapFirst ? "bg-strong text-white" : "bg-card/80 hover:bg-white/20"}`}
        >
          <SlidersHorizontal className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <h2 className="mb-5 mt-8 text-xl font-medium text-muted">Popular events</h2>

      {listed.length === 0 ? (
        <div className="mx-auto max-w-md py-20 text-center">
          <h3 className="text-2xl font-medium">{term ? "No events match your search" : "Nothing on sale right now"}</h3>
          <p className="mt-2 text-muted">{term ? "Try a different name or venue." : "New events appear here as soon as organisers open ticket sales."}</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listed.map((e) => (
            <EventCard key={e.id} event={e} soldOut={salesState(e) === "soldout"} />
          ))}
        </div>
      )}
    </div>
  );
}
