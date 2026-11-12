"use client";

import { useEffect, useState } from "react";
import { Copy, ImagePlus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { UpiQr } from "@/lib/types";

interface Props {
  eventId: string;
}

export default function UpiQrManager({ eventId }: Props) {
  const { getUpiQrs, addUpiQr, deleteUpiQr } = useStore();
  const [qrs, setQrs] = useState<UpiQr[]>([]);
  const [label, setLabel] = useState("");
  const [upiId, setUpiId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => getUpiQrs(eventId).then(setQrs);
  useEffect(() => { load(); }, [eventId]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file (JPG, PNG, or WebP)."); return; }
    if (file.size > 3 * 1024 * 1024) { setError("The image must be under 3 MB."); return; }
    setBusy(true); setError(null);
    const err = await addUpiQr(eventId, file, label.trim(), upiId.trim() || undefined);
    setBusy(false);
    setLabel("");
    setUpiId("");
    e.target.value = "";
    if (err) { setError(err); return; }
    setNotice("QR code added.");
    setTimeout(() => setNotice(null), 3000);
    load();
  };

  const remove = async (qr: UpiQr) => {
    setBusy(true); setError(null);
    const err = await deleteUpiQr(qr.id, qr.storagePath);
    setBusy(false);
    if (err) { setError(err); return; }
    load();
  };

  const copyUpi = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(value); setTimeout(() => setCopied(null), 2000); } catch { /* clipboard blocked */ }
  };

  return (
    <section className="mt-10" aria-labelledby="upi-qrs">
      <h2 id="upi-qrs" className="text-2xl font-semibold">UPI QR codes <span className="text-muted">({qrs.length})</span></h2>
      <p className="mt-1 text-sm text-muted">Upload one or more UPI payment QR codes. Students will see these at checkout and can choose which one they paid to. Add a UPI ID so students can pay directly via UPI as well.</p>

      {error && <p role="alert" className="mt-4 rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad-fg">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-good-soft px-4 py-3 text-sm font-medium text-good-fg">{notice}</p>}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="field-label" htmlFor="qr-label">Label <span className="font-normal text-muted">(optional)</span></label>
          <input
            id="qr-label"
            className="input"
            placeholder="e.g. Axis Bank UPI, GPay"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={60}
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="field-label" htmlFor="qr-upi-id">UPI ID <span className="font-normal text-muted">(optional)</span></label>
          <input
            id="qr-upi-id"
            className="input"
            placeholder="e.g. club@upi"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            maxLength={100}
          />
        </div>
        <label className="btn btn-outline cursor-pointer">
          <ImagePlus className="h-4 w-4" aria-hidden />
          {busy ? "Uploading…" : "Upload QR"}
          <input type="file" accept="image/*" className="sr-only" onChange={upload} disabled={busy} />
        </label>
      </div>

      {qrs.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {qrs.map((qr) => (
            <div key={qr.id} className="overflow-hidden rounded-2xl bg-card">
              {qr.publicUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr.publicUrl} alt={qr.label || "UPI QR code"} className="aspect-square w-full object-contain bg-white" />
              )}
              <div className="p-3">
                <p className="truncate text-sm font-medium">{qr.label || "UPI QR"}</p>
                {qr.upiId && (
                  <button
                    onClick={() => copyUpi(qr.upiId!)}
                    className="mt-1 flex w-full items-center gap-1.5 rounded-lg bg-paper px-2 py-1 text-xs text-muted hover:text-ink"
                    title="Click to copy"
                  >
                    <Copy className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate font-mono">{copied === qr.upiId ? "Copied!" : qr.upiId}</span>
                  </button>
                )}
                <button
                  onClick={() => remove(qr)}
                  disabled={busy}
                  className="mt-2 flex items-center gap-1 text-sm text-muted hover:text-bad-fg"
                  aria-label={`Delete ${qr.label || "QR code"}`}
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
