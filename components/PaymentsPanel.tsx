"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatDateTime, formatINR } from "@/lib/format";

function Thumb({ path, name }: { path: string; name: string }) {
  const { screenshotUrl } = useStore();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    screenshotUrl(path).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [path, screenshotUrl]);
  return (
    <a href={url ?? undefined} target="_blank" rel="noreferrer" aria-label={`Open ${name}'s payment screenshot`} className="block h-28 w-24 shrink-0 overflow-hidden rounded-2xl bg-paper">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Payment screenshot from ${name}`} className="h-full w-full object-cover" />
      ) : (
        <span className="grid h-full place-items-center px-2 text-center text-xs text-muted">{path.startsWith("demo") ? "No image in demo data" : "Loading…"}</span>
      )}
    </a>
  );
}

type Plan = { ids: string[]; approve: boolean; label: string };

/** Review queue: tick people, then approve selected / approve all / approve all except the ticked ones / reject. Emails are sent by the app. */
export default function PaymentsPanel({ eventId }: { eventId: string }) {
  const { pendingPayments, reviewPayments, sendEmails, emailStatus, demo } = useStore();
  const rows = pendingPayments(eventId);
  const em = emailStatus(eventId);

  const [sel, setSel] = useState<Set<string>>(new Set());
  const [plan, setPlan] = useState<Plan | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<{ sent: number; failed: number; remaining: number } | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // forget ticks for payments that have been decided
  useEffect(() => {
    const live = new Set(rows.map((r) => r.order.id));
    setSel((prev) => { const n = new Set([...prev].filter((i) => live.has(i))); return n.size === prev.size ? prev : n; });
  }, [rows]);

  const ids = rows.map((r) => r.order.id);
  const flagged = new Set(rows.filter((r) => r.duplicates > 0).map((r) => r.order.id));
  const picked = ids.filter((i) => sel.has(i));
  const rest = ids.filter((i) => !sel.has(i));
  const clear = ids.filter((i) => !flagged.has(i));
  const nameOf = (id: string) => rows.find((r) => r.order.id === id)?.user.name ?? "this student";
  const flaggedIn = (list: string[]) => list.filter((i) => flagged.has(i)).length;

  const emailNote = (e: { sent: number; failed: number; error?: string }, lead: string) =>
    e.error
      ? `${lead} The emails couldn't be sent (${e.error}). They stay queued: press "Send now" once that's fixed. Approved students can still open their tickets in My tickets.`
      : `${lead} ${e.sent} email${e.sent === 1 ? "" : "s"} sent${e.failed ? `, ${e.failed} failed (press Retry)` : ""}.${demo ? " (Demo mode: no real email is sent.)" : ""}`;

  const execute = async (p: Plan) => {
    setBusy(true); setNotice(null); setProg(null);
    const r = await reviewPayments(p.ids, p.approve, p.approve ? undefined : reason);
    setPlan(null); setSel(new Set()); setReason("");
    if (r.error) { setBusy(false); setNotice({ ok: false, text: r.error }); return; }
    const lead = `${r.decided} ${p.approve ? "approved" : "rejected"}.${r.skipped ? ` ${r.skipped} skipped (already decided).` : ""}`;
    const e = await sendEmails(eventId, { onProgress: setProg });
    setBusy(false); setProg(null);
    setNotice({ ok: !e.error && !e.failed, text: emailNote(e, lead) });
  };

  const drain = async (retryFailed: boolean) => {
    setBusy(true); setNotice(null);
    const e = await sendEmails(eventId, { retryFailed, onProgress: setProg });
    setBusy(false); setProg(null);
    setNotice({ ok: !e.error && !e.failed, text: emailNote(e, "Done.") });
  };

  const ask = (list: string[], approve: boolean, what: string) => {
    const warn = approve && flaggedIn(list) ? ` This includes ${flaggedIn(list)} flagged re-used screenshot${flaggedIn(list) === 1 ? "" : "s"}.` : "";
    setPlan({ ids: list, approve, label: `${approve ? "Approve" : "Reject"} ${what} and email ${list.length === 1 ? "them" : "everyone"} now?${warn}` });
  };

  const total = prog ? prog.sent + prog.failed + prog.remaining : 0;

  return (
    <section className="mt-10" aria-labelledby="payments">
      <h2 id="payments" className="text-2xl font-semibold">Payments to review <span className="text-muted">({rows.length})</span></h2>
      <p className="mt-1 text-sm text-muted">Check each screenshot against your bank or UPI statement. Approving issues the QR ticket and the app emails it to the student.</p>

      {(em.pending > 0 || em.failed > 0) && !busy && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn-fg" role="status">
          <span>{em.pending > 0 ? `${em.pending} email${em.pending === 1 ? "" : "s"} waiting to be sent.` : ""} {em.failed > 0 ? `${em.failed} failed.` : ""}</span>
          {em.pending > 0 && <button className="btn btn-dark !py-1.5 text-sm" onClick={() => drain(false)}>Send now</button>}
          {em.failed > 0 && <button className="btn btn-outline !py-1.5 text-sm" onClick={() => drain(true)}>Retry failed</button>}
        </div>
      )}

      {prog && (
        <div className="mt-4 rounded-2xl bg-card p-4" role="status" aria-live="polite">
          <p className="text-sm font-medium">Emailing tickets… {prog.sent + prog.failed} of {total}</p>
          <progress className="mt-2 h-2 w-full" max={total || 1} value={prog.sent + prog.failed} />
        </div>
      )}
      {notice && <p role={notice.ok ? "status" : "alert"} className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${notice.ok ? "bg-good-soft text-good-fg" : "bg-warn-soft text-warn-fg"}`}>{notice.text}</p>}

      {rows.length === 0 ? (
        <p className="mt-4 rounded-3xl bg-card p-8 text-center text-muted">No payments waiting for review.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="mr-2 flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="h-5 w-5 accent-[#C8102E]" checked={picked.length === ids.length} onChange={(e) => setSel(e.target.checked ? new Set(ids) : new Set())} />
              Select all
            </label>
            <button className="btn btn-primary !py-2" disabled={busy || picked.length === 0} onClick={() => ask(picked, true, `${picked.length} selected payment${picked.length === 1 ? "" : "s"}`)}>Approve selected ({picked.length})</button>
            <button className="btn btn-outline !py-2" disabled={busy || picked.length === 0 || rest.length === 0} onClick={() => ask(rest, true, `all ${rest.length} payments except the ${picked.length} selected`)}>Approve all except selected ({rest.length})</button>
            <button className="btn btn-outline !py-2" disabled={busy || clear.length === 0} onClick={() => ask(clear, true, `all ${clear.length} ${flagged.size ? "unflagged " : ""}payments`)}>Approve all ({clear.length})</button>
            <button className="btn btn-outline !py-2" disabled={busy || picked.length === 0} onClick={() => ask(picked, false, `${picked.length} selected payment${picked.length === 1 ? "" : "s"}`)}>Reject selected ({picked.length})</button>
          </div>
          {flagged.size > 0 && (
            <p className="mt-3 flex items-start gap-2 text-sm font-medium text-bad-fg"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{flagged.size} payment{flagged.size === 1 ? " uses" : "s use"} a screenshot that was already uploaded for another payment. "Approve all" skips them. Check them one by one.</p>
          )}

          {plan && (
            <div className="mt-4 rounded-2xl bg-accent-soft p-4" role="alertdialog" aria-label="Confirm">
              <p className="font-medium">{plan.label}</p>
              {!plan.approve && <input className="input mt-3" placeholder="Reason, e.g. the amount doesn't match" aria-label="Reason for rejecting" value={reason} onChange={(e) => setReason(e.target.value)} />}
              <div className="mt-3 flex gap-2">
                <button className="btn btn-dark !py-2" disabled={busy} onClick={() => execute(plan)}>{plan.approve ? "Yes, approve" : "Yes, reject"}</button>
                <button className="btn btn-outline !py-2" disabled={busy} onClick={() => setPlan(null)}>Cancel</button>
              </div>
            </div>
          )}

          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-3xl bg-card">
            {rows.map((p) => (
              <li key={p.order.id} className="flex gap-3 p-4 sm:gap-4 sm:p-5">
                <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#C8102E]" aria-label={`Select ${p.user.name}`} checked={sel.has(p.order.id)}
                  onChange={(e) => setSel((prev) => { const n = new Set(prev); if (e.target.checked) n.add(p.order.id); else n.delete(p.order.id); return n; })} />
                <Thumb path={p.order.screenshotPath} name={p.user.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-medium">{p.user.name}</p>
                  <p className="truncate text-sm text-muted">{p.user.email} · {p.user.studentId}</p>
                  <p className="mt-1 text-sm">Expected <b>{formatINR(p.order.amount)}</b> · sent {formatDateTime(p.order.createdAt)}</p>
                  {p.duplicates > 0 && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-bad-soft px-3 py-1 text-xs font-semibold text-bad-fg"><AlertTriangle className="h-3.5 w-3.5" aria-hidden />Same screenshot as {p.duplicates} other payment{p.duplicates === 1 ? "" : "s"}</p>}
                  <div className="mt-3 flex gap-2">
                    <button className="btn btn-primary !py-2" disabled={busy} onClick={() => execute({ ids: [p.order.id], approve: true, label: "" })}>Approve</button>
                    <button className="btn btn-outline !py-2" disabled={busy} onClick={() => ask([p.order.id], false, nameOf(p.order.id) + "'s payment")}>Reject</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
