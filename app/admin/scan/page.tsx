"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, CircleX, Clock3, ShieldAlert } from "lucide-react";
import RequireAdmin from "@/components/RequireAdmin";
import CameraScanner from "@/components/CameraScanner";
import { adminClient } from "@/lib/admin";
import { formatClock } from "@/lib/format";
import type { CheckInResult } from "@/lib/types";

function ResultScreen({ result, onDismiss }: { result: CheckInResult; onDismiss: () => void }) {
  useEffect(() => {
    try { navigator.vibrate?.(result.kind === "valid" ? 80 : [200, 80, 200]); } catch {}
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
    <button onClick={onDismiss} role="alertdialog" aria-live="assertive" className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-8 text-center ${cfg.bg}`}>
      <cfg.Icon className="h-28 w-28" strokeWidth={2.5} aria-hidden />
      <p className="font-display text-6xl font-semibold leading-none sm:text-7xl">{cfg.title}</p>
      {"name" in result && <p className="text-4xl font-semibold sm:text-5xl">{result.name}</p>}
      {result.kind === "used" && result.at && <p className="text-2xl font-semibold">First scanned at {formatClock(result.at)}</p>}
      {result.kind === "wrong_event" && <p className="text-2xl font-semibold">This ticket is for {result.eventName}</p>}
      <p className="mt-6 text-lg font-semibold opacity-80">Tap anywhere to scan the next ticket</p>
    </button>
  );
}

function Scanner() {
  const params = useSearchParams();
  const [eventId, setEventId] = useState(params.get("event") ?? "");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [manual, setManual] = useState("");
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => { adminClient.events().then((r) => setEvents(r.events.map((e) => ({ id: e.id, name: e.name })))).catch(() => {}); }, []);

  const selected = events.find((e) => e.id === eventId);

  const handle = async (token: string) => {
    if (!selected || result) return;
    const t = token.trim();
    try {
      const r = await adminClient.checkIn(t, selected.id);
      const blank = { orderId: "", userId: "", eventId: selected.id, token: t, status: "used" as const, createdAt: "" };
      if (r.kind === "valid") setResult({ kind: "valid", name: r.name ?? "", ticket: { ...blank, id: r.ticketId ?? "" } });
      else if (r.kind === "used") setResult({ kind: "used", name: r.name ?? "", at: r.at ?? "", ticket: { ...blank, id: "" } });
      else if (r.kind === "wrong_event") setResult({ kind: "wrong_event", name: r.name ?? "", eventName: r.eventName ?? "another event" });
      else setResult({ kind: "invalid" });
    } catch { setResult({ kind: "invalid" }); }
  };

  if (!selected) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="text-4xl font-semibold">Scan tickets</h1>
        <p className="mt-2 text-muted">Pick any event to check people in.</p>
        {events.length === 0 ? <p className="mt-8 rounded-3xl bg-card p-8 text-center text-muted">No events available.</p> : (
          <ul className="mt-6 space-y-3">
            {events.map((e) => (
              <li key={e.id}><button onClick={() => setEventId(e.id)} className="flex w-full items-center justify-between rounded-3xl bg-card p-5 text-left transition-colors hover:bg-ultra-soft"><span className="text-lg font-semibold">{e.name}</span></button></li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold leading-tight">{selected.name}</h1>
        <button onClick={() => setEventId("")} className="btn btn-outline !py-2">Change event</button>
      </div>
      <div className="mt-6"><CameraScanner onScan={handle} paused={!!result} /><p className="mt-3 text-center text-sm text-muted">Point the camera at the student's QR code.</p></div>
      <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { handle(manual); setManual(""); } }} className="mt-8 flex gap-3">
        <label htmlFor="manual" className="sr-only">Ticket code</label>
        <input id="manual" className="input" placeholder="Type the ticket code" value={manual} onChange={(e) => setManual(e.target.value)} autoCapitalize="characters" autoComplete="off" />
        <button className="btn btn-dark" type="submit">Check in</button>
      </form>
      {result && <ResultScreen result={result} onDismiss={() => setResult(null)} />}
    </div>
  );
}

export default function Page() {
  return <RequireAdmin><Suspense fallback={null}><Scanner /></Suspense></RequireAdmin>;
}
