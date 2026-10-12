"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, CircleX, Clock3, ShieldAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import RequireRole from "@/components/RequireRole";
import CameraScanner from "@/components/CameraScanner";
import { formatClock } from "@/lib/format";
import type { CheckInResult } from "@/lib/types";

/** Full-screen result, readable at a glance in poor light: huge text, flat colour, student name (plan 4.4). */
function ResultScreen({ result, onDismiss }: { result: CheckInResult; onDismiss: () => void }) {
  // Valid scans clear themselves quickly so the queue keeps moving. Problems stay until tapped.
  useEffect(() => {
    try { navigator.vibrate?.(result.kind === "valid" ? 80 : [200, 80, 200]); } catch { /* not supported */ }
    if (result.kind !== "valid") return;
    const t = setTimeout(onDismiss, 2200);
    return () => clearTimeout(t);
  }, [result, onDismiss]);

  const cfg = {
    valid: { bg: "bg-good text-white", Icon: CheckCircle2, title: "Checked in" },
    used: { bg: "bg-warn text-warn-ink", Icon: Clock3, title: "Already used" },
    wrong_event: { bg: "bg-bad text-white", Icon: ShieldAlert, title: "Wrong event" },
    invalid: { bg: "bg-bad text-white", Icon: CircleX, title: "Invalid ticket" },
  }[result.kind];

  return (
    <button
      onClick={onDismiss}
      role="alertdialog"
      aria-live="assertive"
      aria-label={`${cfg.title}. Tap to scan the next ticket.`}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-8 text-center ${cfg.bg}`}
    >
      <cfg.Icon className="h-28 w-28" strokeWidth={2.5} aria-hidden />
      <p className="font-display text-6xl font-semibold leading-none sm:text-7xl">{cfg.title}</p>
      {"name" in result && <p className="text-4xl font-semibold sm:text-5xl">{result.name}</p>}
      {result.kind === "used" && result.at && <p className="text-2xl font-semibold">First scanned at {formatClock(result.at)}</p>}
      {result.kind === "wrong_event" && <p className="text-2xl font-semibold">This ticket is for {result.eventName}</p>}
      {result.kind === "invalid" && <p className="text-2xl font-semibold">This code isn't a ticket we issued</p>}
      <p className="mt-6 text-lg font-semibold opacity-80">Tap anywhere to scan the next ticket</p>
    </button>
  );
}

function Scanner() {
  const params = useSearchParams();
  const { user, events, tickets, checkIn, getStats } = useStore();
  // Only organisers of an event can scan for it (plan 5.3).
  const mine = events.filter((e) => e.organiserId === user?.id);
  const [eventId, setEventId] = useState(params.get("event") ?? "");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [manual, setManual] = useState("");
  const [last, setLast] = useState("");

  const selected = mine.find((e) => e.id === eventId);

  const handle = (token: string) => {
    if (!selected || result) return;
    setLast(token.trim());
    // SERVER: POST /api/checkin { token, eventId }. Validation never happens in the scanner page.
    setResult(checkIn(token, selected.id));
  };

  if (!selected) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="text-4xl font-semibold">Scan tickets</h1>
        <p className="mt-2 text-muted">Pick the event you're checking people into.</p>
        {mine.length === 0 ? (
          <p className="mt-8 rounded-3xl bg-white p-8 text-center text-muted">You don't have any events to scan for yet.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {mine.map((e) => (
              <li key={e.id}>
                <button onClick={() => setEventId(e.id)} className="flex w-full items-center justify-between rounded-3xl bg-white p-5 text-left transition-colors hover:bg-ultra-soft">
                  <span className="text-lg font-semibold">{e.name}</span>
                  <span className="text-sm text-muted">{getStats(e.id).checkedIn} checked in</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const stats = getStats(selected.id);
  // Demo helpers so the three outcomes can be tried without a printed QR.
  const demoActive = tickets.find((t) => t.eventId === selected.id && t.status === "active");
  const demoOther = tickets.find((t) => t.eventId !== selected.id);

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold leading-tight">{selected.name}</h1>
          <p className="mt-1 text-lg font-semibold text-good">{stats.checkedIn} checked in</p>
        </div>
        <button onClick={() => setEventId("")} className="btn btn-outline !py-2">Change event</button>
      </div>

      <div className="mt-6">
        <CameraScanner onScan={handle} paused={!!result} />
        <p className="mt-3 text-center text-sm text-muted">Point the camera at the student's QR code.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { handle(manual); setManual(""); } }} className="mt-8 flex gap-3">
        <label htmlFor="manual" className="sr-only">Ticket code</label>
        <input id="manual" className="input" placeholder="Camera not working? Type the ticket code" value={manual} onChange={(e) => setManual(e.target.value)} autoCapitalize="characters" autoComplete="off" />
        <button className="btn btn-dark" type="submit">Check in</button>
      </form>

      <details className="mt-8 rounded-2xl border-2 border-dashed border-ultra/30 p-4">
        <summary className="cursor-pointer font-semibold">Demo tools</summary>
        <p className="mt-2 text-sm text-muted">Simulate each result without a QR code.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-outline !py-2" disabled={!demoActive} onClick={() => demoActive && handle(demoActive.token)}>Scan a valid ticket</button>
          <button className="btn btn-outline !py-2" disabled={!last} onClick={() => handle(last)}>Scan the last ticket again</button>
          <button className="btn btn-outline !py-2" disabled={!demoOther} onClick={() => demoOther && handle(demoOther.token)}>Scan another event's ticket</button>
          <button className="btn btn-outline !py-2" onClick={() => handle("NOT-A-REAL-TOKEN")}>Scan an unknown code</button>
        </div>
      </details>

      {result && <ResultScreen result={result} onDismiss={() => setResult(null)} />}
    </div>
  );
}

export default function ScanPage() {
  return (
    <RequireRole role="organiser">
      <Suspense fallback={null}>
        <Scanner />
      </Suspense>
    </RequireRole>
  );
}
