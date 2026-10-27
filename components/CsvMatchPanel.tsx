"use client";

import { useEffect, useState } from "react";
import { Upload, Zap, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatINR } from "@/lib/format";
import type { MatchSummary, TxnRecord } from "@/lib/types";

interface Props {
  eventId: string;
}

export default function CsvMatchPanel({ eventId }: Props) {
  const { matchSummary, uploadTxnCsv, runMatch, txnRecords, clearTxnRecords } = useStore();
  const [summary, setSummary] = useState<MatchSummary>({ matched: 0, unmatched: 0, verified: 0, rejected: 0, txnRecords: 0 });
  const [records, setRecords] = useState<TxnRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    const [s, r] = await Promise.all([matchSummary(eventId), txnRecords(eventId)]);
    setSummary(s);
    setRecords(r);
  };
  useEffect(() => { load(); }, [eventId]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(null); setNotice(null);
    const r = await uploadTxnCsv(eventId, file);
    setBusy(false);
    e.target.value = "";
    if (r.error) { setError(r.error); return; }
    setNotice(`Imported ${r.imported} transaction record${r.imported === 1 ? "" : "s"}.`);
    setTimeout(() => setNotice(null), 4000);
    load();
  };

  const onMatch = async () => {
    setBusy(true); setError(null); setNotice(null);
    const r = await runMatch(eventId);
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    setNotice(`Matched ${r.matched} payment${r.matched === 1 ? "" : "s"} against the CSV. ${r.unmatched} still unmatched.`);
    setTimeout(() => setNotice(null), 4000);
    load();
  };

  const onClear = async () => {
    setBusy(true); setError(null);
    const n = await clearTxnRecords(eventId);
    setBusy(false);
    if (n === null) { setError("Couldn't clear the records."); return; }
    setNotice(`Cleared ${n} transaction record${n === 1 ? "" : "s"}.`);
    setTimeout(() => setNotice(null), 3000);
    load();
  };

  return (
    <section className="mt-10" aria-labelledby="csv-match">
      <h2 id="csv-match" className="text-2xl font-semibold">Transaction matching</h2>
      <p className="mt-1 text-sm text-muted">Upload your bank or UPI app's CSV statement. We'll match students' transaction IDs against it automatically.</p>

      {error && <p role="alert" className="mt-4 rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad-fg">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-good-soft px-4 py-3 text-sm font-medium text-good-fg">{notice}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-card p-4">
          <p className="text-3xl font-semibold">{summary.txnRecords}</p>
          <p className="mt-1 text-sm text-muted">CSV records</p>
        </div>
        <div className="rounded-2xl bg-card p-4">
          <p className="text-3xl font-semibold text-good-fg">{summary.matched}</p>
          <p className="mt-1 text-sm text-muted">Auto-matched</p>
        </div>
        <div className="rounded-2xl bg-card p-4">
          <p className="text-3xl font-semibold text-warn-fg">{summary.unmatched}</p>
          <p className="mt-1 text-sm text-muted">Unmatched</p>
        </div>
        <div className="rounded-2xl bg-card p-4">
          <p className="text-3xl font-semibold">{summary.verified}</p>
          <p className="mt-1 text-sm text-muted">Verified</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <label className="btn btn-outline cursor-pointer">
          <Upload className="h-4 w-4" aria-hidden />
          {busy ? "Working…" : "Upload CSV"}
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onUpload} disabled={busy} />
        </label>
        <button className="btn btn-primary" onClick={onMatch} disabled={busy || summary.txnRecords === 0}>
          <Zap className="h-4 w-4" aria-hidden /> Run match
        </button>
        {records.length > 0 && (
          <button className="btn btn-outline !text-bad-fg" onClick={onClear} disabled={busy}>
            <Trash2 className="h-4 w-4" aria-hidden /> Clear records
          </button>
        )}
      </div>

      {records.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-3xl bg-card">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Transaction ID</th>
                <th className="px-5 py-3 font-semibold">Amount</th>
                <th className="px-5 py-3 font-semibold">Imported</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {records.slice(0, 100).map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3 font-mono text-xs">{r.txnId}</td>
                  <td className="px-5 py-3">{r.amount !== undefined ? formatINR(r.amount) : "—"}</td>
                  <td className="px-5 py-3 text-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {records.length > 100 && <p className="px-5 py-3 text-sm text-muted">Showing first 100 of {records.length} records.</p>}
        </div>
      )}
    </section>
  );
}
