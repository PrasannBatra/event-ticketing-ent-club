"use client";

import { useEffect, useState } from "react";
import { Upload, Zap, Trash2 } from "lucide-react";
import { adminClient } from "@/lib/admin";
import { formatINR } from "@/lib/format";

interface Summary { matched: number; unmatched: number; verified: number; rejected: number; txnRecords: number }
interface Record { id: string; txn_id: string; amount: number | null; created_at: string }

export default function AdminCsvMatchPanel({ eventId }: { eventId: string }) {
  const [summary, setSummary] = useState<Summary>({ matched: 0, unmatched: 0, verified: 0, rejected: 0, txnRecords: 0 });
  const [records, setRecords] = useState<Record[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    try {
      const [s, r] = await Promise.all([adminClient.matchSummary(eventId), adminClient.txnRecords(eventId)]);
      setSummary(s); setRecords(r.records ?? []);
    } catch { /* ignore */ }
  };
  useEffect(() => { load(); }, [eventId]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.set("csv", file);
      const r = await adminClient.uploadTxnCsv(eventId, form);
      setNotice(`Imported ${r.imported} records.`);
      setTimeout(() => setNotice(null), 4000);
      load();
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
    e.target.value = "";
  };

  const onMatch = async () => {
    setBusy(true); setError(null);
    try {
      const r = await adminClient.runMatch(eventId);
      setNotice(`Matched ${r.matched}. ${r.unmatched} unmatched.`);
      setTimeout(() => setNotice(null), 4000);
      load();
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  };

  const onClear = async () => {
    setBusy(true); setError(null);
    try { const r = await adminClient.clearTxnRecords(eventId); setNotice(`Cleared ${r.deleted} records.`); setTimeout(() => setNotice(null), 3000); load(); }
    catch (err) { setError((err as Error).message); }
    setBusy(false);
  };

  return (
    <section aria-labelledby="admin-csv-match">
      <h2 id="admin-csv-match" className="text-2xl font-semibold">Transaction matching</h2>
      <p className="mt-1 text-sm text-muted">Upload a CSV statement to auto-match students' transaction IDs.</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad-fg">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-good-soft px-4 py-3 text-sm font-medium text-good-fg">{notice}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-card p-4"><p className="text-3xl font-semibold">{summary.txnRecords}</p><p className="text-sm text-muted">CSV records</p></div>
        <div className="rounded-2xl bg-card p-4"><p className="text-3xl font-semibold text-good-fg">{summary.matched}</p><p className="text-sm text-muted">Matched</p></div>
        <div className="rounded-2xl bg-card p-4"><p className="text-3xl font-semibold text-warn-fg">{summary.unmatched}</p><p className="text-sm text-muted">Unmatched</p></div>
        <div className="rounded-2xl bg-card p-4"><p className="text-3xl font-semibold">{summary.verified}</p><p className="text-sm text-muted">Verified</p></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="btn btn-outline cursor-pointer"><Upload className="h-4 w-4" aria-hidden /> {busy ? "Working…" : "Upload CSV"}<input type="file" accept=".csv" className="sr-only" onChange={onUpload} disabled={busy} /></label>
        <button className="btn btn-primary" onClick={onMatch} disabled={busy || summary.txnRecords === 0}><Zap className="h-4 w-4" /> Run match</button>
        {records.length > 0 && <button className="btn btn-outline !text-bad-fg" onClick={onClear} disabled={busy}><Trash2 className="h-4 w-4" /> Clear</button>}
      </div>
      {records.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-3xl bg-card">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead className="border-b border-line text-muted"><tr><th className="px-5 py-3 font-semibold">Transaction ID</th><th className="px-5 py-3 font-semibold">Amount</th><th className="px-5 py-3 font-semibold">Imported</th></tr></thead>
            <tbody className="divide-y divide-line">
              {records.slice(0, 100).map((r) => (<tr key={r.id}><td className="px-5 py-3 font-mono text-xs">{r.txn_id}</td><td className="px-5 py-3">{r.amount !== null ? formatINR(r.amount) : "—"}</td><td className="px-5 py-3 text-muted">{new Date(r.created_at).toLocaleDateString()}</td></tr>))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
