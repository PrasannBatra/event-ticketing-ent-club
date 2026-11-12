"use client";

import { useEffect, useState } from "react";
import { Copy, ImagePlus, Trash2 } from "lucide-react";
import { adminClient } from "@/lib/admin";

interface Qr { id: string; label: string; upi_id: string | null; storage_path: string; url?: string; created_at: string }

export default function AdminUpiQrManager({ eventId }: { eventId: string }) {
  const [qrs, setQrs] = useState<Qr[]>([]);
  const [label, setLabel] = useState("");
  const [upiId, setUpiId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    try { const r = await adminClient.getUpiQrs(eventId); setQrs(r.qrs ?? []); } catch { setQrs([]); }
  };
  useEffect(() => { load(); }, [eventId]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; }
    if (file.size > 3 * 1024 * 1024) { setError("Image must be under 3 MB."); return; }
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.set("label", label.trim());
      if (upiId.trim()) form.set("upiId", upiId.trim());
      form.set("qr", file);
      await adminClient.addUpiQr(eventId, form);
      setLabel(""); setUpiId(""); setNotice("QR code added.");
      setTimeout(() => setNotice(null), 3000);
      load();
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
    e.target.value = "";
  };

  const remove = async (qr: Qr) => {
    setBusy(true); setError(null);
    try { await adminClient.deleteUpiQr(qr.id, qr.storage_path); load(); } catch (err) { setError((err as Error).message); }
    setBusy(false);
  };

  const copyUpi = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(value); setTimeout(() => setCopied(null), 2000); } catch { /* clipboard blocked */ }
  };

  return (
    <section aria-labelledby="admin-upi-qrs">
      <h2 id="admin-upi-qrs" className="text-2xl font-semibold">UPI QR codes <span className="text-muted">({qrs.length})</span></h2>
      <p className="mt-1 text-sm text-muted">Upload UPI payment QR codes for this event. Students see them at checkout. Add a UPI ID so students can pay directly via UPI as well.</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad-fg">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-good-soft px-4 py-3 text-sm font-medium text-good-fg">{notice}</p>}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="field-label">Label (optional)</label>
          <input className="input" placeholder="e.g. Axis Bank UPI" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="field-label">UPI ID (optional)</label>
          <input className="input" placeholder="e.g. club@upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} maxLength={100} />
        </div>
        <label className="btn btn-outline cursor-pointer">
          <ImagePlus className="h-4 w-4" aria-hidden /> {busy ? "Uploading…" : "Upload QR"}
          <input type="file" accept="image/*" className="sr-only" onChange={upload} disabled={busy} />
        </label>
      </div>
      {qrs.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {qrs.map((qr) => (
            <div key={qr.id} className="overflow-hidden rounded-2xl bg-card">
              {qr.url && <img src={qr.url} alt={qr.label || "QR"} className="aspect-square w-full object-contain bg-white" />}
              <div className="p-3">
                <p className="truncate text-sm font-medium">{qr.label || "UPI QR"}</p>
                {qr.upi_id && (
                  <button
                    onClick={() => copyUpi(qr.upi_id!)}
                    className="mt-1 flex w-full items-center gap-1.5 rounded-lg bg-paper px-2 py-1 text-xs text-muted hover:text-ink"
                    title="Click to copy"
                  >
                    <Copy className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate font-mono">{copied === qr.upi_id ? "Copied!" : qr.upi_id}</span>
                  </button>
                )}
                <button onClick={() => remove(qr)} disabled={busy} className="mt-2 flex items-center gap-1 text-sm text-muted hover:text-bad-fg" aria-label="Delete QR"><Trash2 className="h-4 w-4" /> Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
