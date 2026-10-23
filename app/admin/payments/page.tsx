"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X, CheckCircle2, CircleX, AlertTriangle, Expand, Mail, RefreshCw } from "lucide-react";
import RequireAdmin from "@/components/RequireAdmin";
import { adminClient, type AdminOrder, type AdminEvent } from "@/lib/admin";
import { formatINR, formatDateTime } from "@/lib/format";

const statusChip: Record<string, { label: string; cls: string }> = {
  awaiting_review: { label: "Pending", cls: "bg-warn-soft text-warn-fg" },
  approved: { label: "Approved", cls: "bg-good-soft text-good-fg" },
  rejected: { label: "Rejected", cls: "bg-bad-soft text-bad-fg" },
};
const emailChip: Record<string, { label: string; cls: string }> = {
  pending: { label: "Queued", cls: "bg-line text-muted" },
  sending: { label: "Sending", cls: "bg-ultra-soft text-ultra-dark" },
  sent: { label: "Sent", cls: "bg-good-soft text-good-fg" },
  failed: { label: "Failed", cls: "bg-bad-soft text-bad-fg" },
};

function PaymentsPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEvent, setFilterEvent] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<AdminOrder | null>(null);
  const [confirm, setConfirm] = useState<null | { type: "approveAll" | "approveSelected" | "rejectSelected"; count: number }>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [or, ev] = await Promise.all([adminClient.orders(filterEvent || undefined, filterStatus || undefined), adminClient.events()]);
      setOrders(or.orders);
      setEvents(ev.events);
    } catch (e) { setMsg((e as Error).message); }
    setLoading(false);
  }, [filterEvent, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return orders;
    return orders.filter((o) => o.buyer_name.toLowerCase().includes(t) || o.buyer_email.toLowerCase().includes(t) || o.event_name.toLowerCase().includes(t));
  }, [orders, search]);

  const pendingIds = useMemo(() => filtered.filter((o) => o.payment_status === "awaiting_review").map((o) => o.order_id), [filtered]);
  const selectedPending = useMemo(() => [...selected].filter((id) => pendingIds.includes(id)), [selected, pendingIds]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((s) => { const allPending = pendingIds; if (allPending.every((id) => s.has(id))) { const n = new Set(s); allPending.forEach((id) => n.delete(id)); return n; } return new Set([...s, ...allPending]); });

  const doReview = async (ids: string[], approve: boolean, reason?: string) => {
    setBusy(true); setMsg(null);
    try {
      const r = await adminClient.reviewPayments(ids, approve, reason);
      setMsg(`${r.decided} ${approve ? "approved" : "rejected"}, ${r.skipped} skipped.`);
      setSelected(new Set());
      await load();
      if (approve) {
        // Try sending emails for all events involved
        const eventIds = [...new Set(orders.filter((o) => ids.includes(o.order_id)).map((o) => o.event_id))];
        for (const eid of eventIds) { try { await adminClient.sendEmails(eid); } catch {} }
        await load();
      }
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false); setConfirm(null); setRejectReason("");
  };

  return (
    <div>
      <h1 className="text-4xl font-semibold sm:text-5xl">Payments</h1>
      <p className="mt-2 text-muted">Review payment screenshots, approve or reject purchases, and send tickets.</p>

      {msg && <p role="alert" className="mt-4 rounded-xl bg-ultra-soft px-4 py-3 text-sm font-medium text-ultra-dark">{msg}</p>}

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-3">
        <select className="input !w-auto" value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)}>
          <option value="">All events</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select className="input !w-auto" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="awaiting_review">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
          <input className="input !pl-12" placeholder="Search buyer or event" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Bulk actions */}
      {pendingIds.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-card p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={pendingIds.every((id) => selected.has(id))} onChange={toggleAll} className="h-5 w-5 rounded" />
            Select all pending ({pendingIds.length})
          </label>
          <span className="text-sm text-muted">{selectedPending.length} selected</span>
          <div className="flex-1" />
          {selectedPending.length > 0 && (
            <>
              <button className="btn btn-primary !py-2" disabled={busy} onClick={() => setConfirm({ type: "approveSelected", count: selectedPending.length })}>
                <CheckCircle2 className="h-4 w-4" /> Approve selected ({selectedPending.length})
              </button>
              <button className="btn btn-outline !py-2" disabled={busy} onClick={() => setConfirm({ type: "rejectSelected", count: selectedPending.length })}>
                <CircleX className="h-4 w-4" /> Reject selected
              </button>
            </>
          )}
          <button className="btn btn-dark !py-2" disabled={busy} onClick={() => setConfirm({ type: "approveAll", count: pendingIds.length })}>
            Approve all pending ({pendingIds.length})
          </button>
        </div>
      )}

      {/* Table */}
      <div className="mt-5 overflow-x-auto rounded-3xl bg-card">
        {loading ? <p className="p-8 text-center text-muted">Loading…</p> :
         filtered.length === 0 ? <p className="p-8 text-center text-muted">No purchases found.</p> : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th className="p-4"></th>
                <th className="p-4">Buyer</th>
                <th className="p-4">Event</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Date</th>
                <th className="p-4">Screenshot</th>
                <th className="p-4">Payment</th>
                <th className="p-4">Email</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((o) => {
                const st = statusChip[o.payment_status] ?? statusChip.awaiting_review;
                const em = emailChip[o.email_status] ?? emailChip.pending;
                const isPending = o.payment_status === "awaiting_review";
                return (
                  <tr key={o.order_id} className="hover:bg-ultra-soft/40">
                    <td className="p-4">
                      {isPending && <input type="checkbox" checked={selected.has(o.order_id)} onChange={() => toggle(o.order_id)} className="h-5 w-5 rounded" />}
                    </td>
                    <td className="p-4"><p className="font-medium">{o.buyer_name}</p><p className="text-xs text-muted">{o.buyer_email}</p></td>
                    <td className="p-4">{o.event_name}</td>
                    <td className="p-4 font-medium">{formatINR(Number(o.amount))}</td>
                    <td className="p-4 text-muted">{formatDateTime(o.created_at)}</td>
                    <td className="p-4">
                      {o.screenshot_url ? (
                        <button onClick={() => setPreview(o)} className="flex items-center gap-1 text-ultra hover:underline">
                          <Expand className="h-4 w-4" /> View
                        </button>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td className="p-4"><span className={`chip ${st.cls}`}>{st.label}</span></td>
                    <td className="p-4"><span className={`chip ${em.cls}`}>{em.label}</span></td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {isPending && <button className="btn btn-primary !py-1.5 !px-3 text-xs" disabled={busy} onClick={() => doReview([o.order_id], true)}>Approve</button>}
                        {isPending && <button className="btn btn-outline !py-1.5 !px-3 text-xs" disabled={busy} onClick={() => { setSelected(new Set([o.order_id])); setConfirm({ type: "rejectSelected", count: 1 }); }}>Reject</button>}
                        {o.payment_status === "approved" && <button className="btn btn-outline !py-1.5 !px-3 text-xs" onClick={async () => { try { const r = await adminClient.resendEmail(o.order_id); setMsg(`Email sent to ${r.to}`); } catch (e) { setMsg((e as Error).message); } }}><Mail className="h-3 w-3" /> Resend</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Screenshot modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreview(null)}>
          <div className="relative max-h-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreview(null)} className="absolute -top-12 right-0 text-white" aria-label="Close"><X className="h-8 w-8" /></button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.screenshot_url ?? ""} alt={`Payment screenshot from ${preview.buyer_name}`} className="max-h-[85vh] w-auto rounded-2xl" />
            <div className="mt-3 rounded-xl bg-card p-4">
              <p className="font-medium">{preview.buyer_name} — {preview.event_name}</p>
              <p className="text-sm text-muted">{formatINR(Number(preview.amount))} · {formatDateTime(preview.created_at)}</p>
              {preview.payment_status === "awaiting_review" && (
                <div className="mt-3 flex gap-2">
                  <button className="btn btn-primary !py-2" disabled={busy} onClick={() => { doReview([preview.order_id], true); setPreview(null); }}>Approve</button>
                  <button className="btn btn-outline !py-2" disabled={busy} onClick={() => { setSelected(new Set([preview.order_id])); setConfirm({ type: "rejectSelected", count: 1 }); setPreview(null); }}>Reject</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirm(null)}>
          <div className="max-w-md rounded-3xl bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-warn-fg" />
              <h2 className="text-xl font-semibold">
                {confirm.type === "approveAll" ? `Approve all ${confirm.count} pending payments?` : confirm.type === "approveSelected" ? `Approve ${confirm.count} selected payments?` : `Reject ${confirm.count} payment${confirm.count > 1 ? "s" : ""}?`}
              </h2>
            </div>
            <p className="mt-3 text-muted">
              {confirm.type.startsWith("approve") ? "Tickets will be generated and emails sent automatically. This cannot be undone." : "The buyer will be notified and can upload a new screenshot."}
            </p>
            {confirm.type === "rejectSelected" && (
              <div className="mt-4">
                <label className="field-label">Reason (optional)</label>
                <input className="input" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Screenshot unclear" />
              </div>
            )}
            <div className="mt-5 flex gap-3">
              <button className="btn btn-outline" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
              <button className={`btn ${confirm.type.startsWith("approve") ? "btn-primary" : "btn-dark"}`} disabled={busy} onClick={() => {
                const ids = confirm.type === "approveAll" ? pendingIds : [...selected];
                doReview(ids, confirm.type.startsWith("approve"), rejectReason || undefined);
              }}>
                {busy ? "Processing…" : confirm.type.startsWith("approve") ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <RequireAdmin><PaymentsPage /></RequireAdmin>;
}
