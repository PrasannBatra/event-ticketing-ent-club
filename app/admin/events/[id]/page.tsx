"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Save, Trash2, Send, RefreshCw, Download } from "lucide-react";
import RequireAdmin from "@/components/RequireAdmin";
import Poster from "@/components/Poster";
import AdminUpiQrManager from "@/components/AdminUpiQrManager";
import AdminCsvMatchPanel from "@/components/AdminCsvMatchPanel";
import { adminClient, type AdminEvent } from "@/lib/admin";
import { formatDate, formatINR, formatTime, formatDateTime, toLocalInput } from "@/lib/format";

export default function Page({ params }: { params: { id: string } }) {
  return <RequireAdmin><EventEditor id={params.id} /></RequireAdmin>;
}

function EventEditor({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<{ event: AdminEvent; stats: any; attendees: any[]; pending: any[]; email: any } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"details" | "payments" | "attendees" | "emails">("details");

  // edit form
  const [f, setF] = useState<Record<string, string>>({});
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const d = await adminClient.eventDetail(id);
      setData(d);
      const e = d.event;
      setF({
        name: e.name, description: e.description, date: e.date, time: String(e.time).slice(0, 5),
        venue: e.venue, price: String(e.ticket_price), capacity: e.capacity ? String(e.capacity) : "",
        salesOpen: toLocalInput(new Date(e.sales_open)), salesClose: toLocalInput(new Date(e.sales_close)),
        published: e.published ? "true" : "false", archived: e.archived ? "true" : "false",
        posterUrl: e.poster_url ?? "",
      });
    } catch (e) { setError((e as Error).message); }
  };

  useEffect(() => { load(); }, [id]);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const form = new FormData();
      form.set("name", f.name); form.set("description", f.description); form.set("date", f.date); form.set("time", f.time);
      form.set("venue", f.venue); form.set("price", f.price); form.set("capacity", f.capacity || "");
      form.set("salesOpen", new Date(f.salesOpen).toISOString()); form.set("salesClose", new Date(f.salesClose).toISOString());
      form.set("published", f.published === "false" ? "false" : "true");
      form.set("archived", f.archived);
      form.set("posterUrl", f.posterUrl || "");
      if (posterFile) form.set("poster", posterFile);
      await adminClient.updateEvent(id, form);
      setMsg("Event updated.");
      await load();
    } catch (e) { setMsg((e as Error).message); }
    setSaving(false);
  };

  const archive = async () => {
    setArchiving(true);
    try { await adminClient.deleteEvent(id); router.push("/admin/events"); } catch (e) { setMsg((e as Error).message); }
    setArchiving(false);
  };

  const sendEmails = async (retry: boolean) => {
    setSendingEmails(true); setMsg(null);
    try {
      let sent = 0, failed = 0, remaining = 1;
      while (remaining > 0) {
        const r = await adminClient.sendEmails(id, retry);
        sent += r.sent; failed += r.failed; remaining = r.remaining;
        if (r.sent + r.failed === 0 && remaining > 0) break;
        retry = false;
      }
      setMsg(`Sent ${sent} email${sent !== 1 ? "s" : ""}${failed ? `, ${failed} failed` : ""}.`);
      await load();
    } catch (e) { setMsg((e as Error).message); }
    setSendingEmails(false);
  };

  if (error) return <div className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad-fg">{error}</div>;
  if (!data) return <p className="py-8 text-center text-muted">Loading…</p>;
  const e = data.event;
  const stats = data.stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-20 w-16 shrink-0 overflow-hidden rounded-2xl"><Poster event={{ id: e.id, name: e.name, posterUrl: e.poster_url ?? undefined, posterTheme: e.name.length % 5 } as any} /></div>
          <div>
            <h1 className="text-3xl font-semibold sm:text-4xl">{e.name}</h1>
            <p className="text-muted">{formatDate(e.date)}, {formatTime(e.time)} at {e.venue}</p>
            <div className="mt-1 flex gap-2">
              {e.archived ? <span className="chip bg-line text-muted">Archived</span> : e.published ? <span className="chip bg-good-soft text-good-fg">Published</span> : <span className="chip bg-warn-soft text-warn-fg">Unpublished</span>}
              {e.organiser_name && <span className="chip bg-ultra-soft text-ultra-dark">By {e.organiser_name}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Sold" value={String(stats?.sold ?? 0)} />
        <Stat label="Revenue" value={formatINR(Number(stats?.revenue ?? 0))} />
        <Stat label="Checked in" value={String(stats?.checked_in ?? 0)} />
        <Stat label="Pending" value={String(stats?.pending ?? 0)} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-full bg-card p-1">
        {(["details", "payments", "attendees", "emails"] as const).map((t) => (
          <button key={t} className={`rounded-full px-5 py-2 text-sm font-medium capitalize ${tab === t ? "bg-accent text-white" : "text-muted hover:text-ink"}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {msg && <p role="status" className="rounded-xl bg-ultra-soft px-4 py-3 text-sm font-medium text-ultra-dark">{msg}</p>}

      {tab === "details" && (
        <div className="space-y-5">
          <div><label className="field-label">Event name</label><input className="input" value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><label className="field-label">Description</label><textarea rows={5} className="input" value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label className="field-label">Date</label><input type="date" className="input" value={f.date ?? ""} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
            <div><label className="field-label">Time</label><input type="time" className="input" value={f.time ?? ""} onChange={(e) => setF({ ...f, time: e.target.value })} /></div>
          </div>
          <div><label className="field-label">Venue</label><input className="input" value={f.venue ?? ""} onChange={(e) => setF({ ...f, venue: e.target.value })} /></div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label className="field-label">Price (₹)</label><input type="number" min={0} className="input" value={f.price ?? ""} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
            <div><label className="field-label">Capacity</label><input type="number" min={1} className="input" value={f.capacity ?? ""} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label className="field-label">Sales open</label><input type="datetime-local" className="input" value={f.salesOpen ?? ""} onChange={(e) => setF({ ...f, salesOpen: e.target.value })} /></div>
            <div><label className="field-label">Sales close</label><input type="datetime-local" className="input" value={f.salesClose ?? ""} onChange={(e) => setF({ ...f, salesClose: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={f.published === "true"} onChange={(e) => setF({ ...f, published: e.target.checked ? "true" : "false" })} className="h-5 w-5" /> Published</label>
          </div>
          <div>
            <span className="field-label">Poster</span>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-ultra/40 bg-card px-4 py-5 font-semibold text-ultra-dark hover:bg-ultra-soft">
              <ImagePlus className="h-5 w-5" /> {posterFile ? "Change poster" : "Upload new poster"}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => setPosterFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="flex gap-3">
            <button className="btn btn-primary" disabled={saving} onClick={save}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}</button>
            <button className="btn btn-outline" disabled={archiving} onClick={archive}><Trash2 className="h-4 w-4" /> Archive event</button>
          </div>
        </div>
      )}

      {tab === "payments" && (
        <div className="space-y-8">
          <AdminUpiQrManager eventId={id} />
          <AdminCsvMatchPanel eventId={id} />
          {data.pending.length === 0 ? (
            <p className="rounded-3xl bg-card p-8 text-center text-muted">No payments waiting for review.</p>
          ) : (
            <div className="overflow-x-auto rounded-3xl bg-card">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-line text-muted"><tr><th className="p-4">Buyer</th><th className="p-4">Amount</th><th className="p-4">Txn ID</th><th className="p-4">Match</th><th className="p-4">Actions</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {data.pending.map((p: any) => (
                    <tr key={p.order_id}>
                      <td className="p-4"><p className="font-medium">{p.name}</p><p className="text-xs text-muted">{p.email}</p></td>
                      <td className="p-4">{formatINR(Number(p.amount))}</td>
                      <td className="p-4 font-mono text-xs">{p.txn_id ?? "—"}</td>
                      <td className="p-4">{p.match_status === "matched" ? <span className="chip bg-good-soft text-good-fg">Matched</span> : <span className="chip bg-line text-muted">Unmatched</span>}</td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button className="btn btn-primary !py-1.5 text-sm" disabled={busy} onClick={async () => { setBusy(true); await adminClient.reviewPayments([p.order_id], true); setBusy(false); load(); }}>Approve</button>
                          <button className="btn btn-outline !py-1.5 text-sm" disabled={busy} onClick={async () => { const reason = prompt("Reason for rejection?"); setBusy(true); await adminClient.reviewPayments([p.order_id], false, reason ?? undefined); setBusy(false); load(); }}>Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "attendees" && (
        <div className="overflow-x-auto rounded-3xl bg-card">
          {data.attendees.length === 0 ? <p className="p-8 text-center text-muted">No attendees yet.</p> : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-muted"><tr><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Ticket</th><th className="p-4">Status</th><th className="p-4">Bought</th></tr></thead>
              <tbody className="divide-y divide-line">
                {data.attendees.map((a) => (
                  <tr key={a.ticket_id}>
                    <td className="p-4 font-medium">{a.name}</td>
                    <td className="p-4 text-muted">{a.email}</td>
                    <td className="p-4 font-mono text-xs">{a.ticket_id}</td>
                    <td className="p-4"><span className={`chip ${a.status === "used" ? "bg-good-soft text-good-fg" : "bg-ultra-soft text-ultra-dark"}`}>{a.status === "used" ? "Checked in" : "Unused"}</span></td>
                    <td className="p-4 text-muted">{formatDateTime(a.bought_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "emails" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <Stat label="Queued" value={String(data.email?.pending ?? 0)} />
            <Stat label="Sending" value={String(data.email?.sending ?? 0)} />
            <Stat label="Sent" value={String(data.email?.sent ?? 0)} />
            <Stat label="Failed" value={String(data.email?.failed ?? 0)} />
          </div>
          <div className="flex gap-3">
            <button className="btn btn-primary" disabled={sendingEmails} onClick={() => sendEmails(false)}><Send className="h-4 w-4" /> {sendingEmails ? "Sending…" : "Send queued emails"}</button>
            <button className="btn btn-outline" disabled={sendingEmails} onClick={() => sendEmails(true)}><RefreshCw className="h-4 w-4" /> Retry failed</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-edge/60 bg-card p-4"><p className="text-2xl font-semibold">{value}</p><p className="text-sm text-muted">{label}</p></div>;
}
