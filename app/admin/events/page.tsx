"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PlusCircle, Archive, Edit3 } from "lucide-react";
import RequireAdmin from "@/components/RequireAdmin";
import Poster from "@/components/Poster";
import { adminClient, type AdminEvent } from "@/lib/admin";
import { formatDate, formatINR, formatTime } from "@/lib/format";

function EventsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEvents((await adminClient.events()).events); } catch (e) { setMsg((e as Error).message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const archive = async (id: string) => {
    setArchiving(id);
    try { await adminClient.deleteEvent(id); await load(); } catch (e) { setMsg((e as Error).message); }
    setArchiving(null);
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold sm:text-5xl">Events</h1>
          <p className="mt-2 text-muted">Create, edit, publish or archive events across the platform.</p>
        </div>
        <Link href="/admin/events/new" className="btn btn-primary"><PlusCircle className="h-4 w-4" /> New event</Link>
      </div>

      {msg && <p role="alert" className="mt-4 rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad-fg">{msg}</p>}

      <div className="mt-6 overflow-hidden rounded-3xl bg-card">
        {loading ? <p className="p-8 text-center text-muted">Loading…</p> :
         events.length === 0 ? <p className="p-8 text-center text-muted">No events yet.</p> : (
          <ul className="divide-y divide-line">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-4 p-4 sm:p-5">
                <div className="h-20 w-16 shrink-0 overflow-hidden rounded-2xl"><Poster event={{ id: e.id, name: e.name, posterUrl: e.poster_url ?? undefined, posterTheme: e.name.length % 5 } as any} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-semibold">{e.name}</h2>
                    {e.archived && <span className="chip bg-line text-muted">Archived</span>}
                    {!e.published && !e.archived && <span className="chip bg-warn-soft text-warn-fg">Unpublished</span>}
                    {e.published && !e.archived && <span className="chip bg-good-soft text-good-fg">Published</span>}
                  </div>
                  <p className="text-sm text-muted">{formatDate(e.date)}, {formatTime(e.time)} at {e.venue}</p>
                  <p className="text-sm text-muted">{formatINR(Number(e.ticket_price))} · {e.sold} sold · {e.pending} pending</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/admin/events/${e.id}`} className="btn btn-outline !py-2"><Edit3 className="h-4 w-4" /> Edit</Link>
                  {!e.archived && <button className="btn !py-2 text-muted" disabled={archiving === e.id} onClick={() => archive(e.id)}><Archive className="h-4 w-4" /> Archive</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <RequireAdmin><EventsPage /></RequireAdmin>;
}
