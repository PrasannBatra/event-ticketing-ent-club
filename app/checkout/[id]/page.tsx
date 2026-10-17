"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Copy, Hourglass, ImagePlus } from "lucide-react";
import { useStore } from "@/lib/store";
import RequireRole from "@/components/RequireRole";
import Poster from "@/components/Poster";
import { PAYMENT_PAYEE, PAYMENT_UPI_ID } from "@/lib/config";
import { formatDate, formatINR, formatTime } from "@/lib/format";

function Checkout() {
  const { id } = useParams<{ id: string }>();
  const { getEvent, salesState, submitPayment, orders, user } = useStore();
  const event = getEvent(id);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (!event) {
    return <p className="py-24 text-center text-muted">We couldn't find that event. <Link className="font-semibold text-ultra" href="/">Back to events</Link></p>;
  }

  const mine = orders.filter((o) => o.eventId === event.id);
  const waiting = mine.some((o) => o.paymentStatus === "awaiting_review");
  const hasTicket = mine.some((o) => o.paymentStatus === "approved");
  const state = salesState(event);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("Choose an image file (JPG or PNG).");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!file) return setError("Upload your payment screenshot first.");
    setBusy(true);
    setError(null);
    const r = await submitPayment(event.id, file);
    setBusy(false);
    if (r.ok) setSent(true);
    else setError(r.reason);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(PAYMENT_UPI_ID); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };

  if (sent || waiting || hasTicket) {
    return (
      <div className="mx-auto max-w-md py-16 text-center" role="status">
        {hasTicket && !sent ? <CheckCircle2 className="mx-auto h-16 w-16 text-good" aria-hidden /> : <Hourglass className="mx-auto h-16 w-16 text-accent-dark" aria-hidden />}
        <h1 className="mt-6 text-4xl font-semibold">{hasTicket && !sent ? "You already have a ticket" : "We've got your payment"}</h1>
        <p className="mx-auto mt-3 max-w-sm text-muted">
          {hasTicket && !sent
            ? "Your ticket is in My tickets."
            : `An organiser is checking your screenshot for ${event.name}. As soon as it's approved, we'll email your QR ticket to ${user?.email ?? "you"}. It will also be in My tickets.`}
        </p>
        <Link href="/tickets" className="btn btn-primary btn-lg mt-8">Go to My tickets</Link>
      </div>
    );
  }

  if (state !== "open") {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-3xl font-semibold">{state === "upcoming" ? "Sales haven't opened yet" : "Sales closed"}</h1>
        <Link href={`/events/${event.id}`} className="btn btn-dark mt-6">Back to event</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-4xl font-semibold">Pay and upload your screenshot</h1>

      <div className="mt-6 flex gap-4 rounded-3xl bg-white p-4">
        <div className="h-28 w-24 shrink-0 overflow-hidden rounded-2xl"><Poster event={event} /></div>
        <div className="min-w-0">
          <h2 className="text-xl font-medium leading-tight">{event.name}</h2>
          <p className="mt-1 text-sm text-muted">{formatDate(event.date)}, {formatTime(event.time)}</p>
          <p className="text-sm text-muted">{event.venue}</p>
          <p className="mt-2 text-2xl font-medium">{formatINR(event.price)}</p>
        </div>
      </div>

      <ol className="mt-6 space-y-4 rounded-3xl bg-white p-5">
        <li className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-sm font-medium text-white">1</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Pay {formatINR(event.price)} by UPI to {PAYMENT_PAYEE}</p>
            <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl bg-paper px-4 py-3">
              <code className="truncate text-[15px]">{PAYMENT_UPI_ID}</code>
              <button onClick={copy} className="btn btn-outline !px-3 !py-1.5 text-sm"><Copy className="h-4 w-4" aria-hidden />{copied ? "Copied" : "Copy"}</button>
            </div>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-sm font-medium text-white">2</span>
          <p className="font-medium">Take a screenshot that shows the amount and the transaction ID</p>
        </li>
        <li className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-sm font-medium text-white">3</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Upload it here</p>
            <input ref={inputRef} type="file" accept="image/*" className="sr-only" id="shot" onChange={pick} />
            <label htmlFor="shot" className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/20 px-4 py-6 font-medium hover:bg-black/5">
              <ImagePlus className="h-5 w-5" aria-hidden />{file ? "Change screenshot" : "Choose screenshot"}
            </label>
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Your payment screenshot" className="mt-3 max-h-72 rounded-2xl border border-line object-contain" />
            )}
          </div>
        </li>
      </ol>

      {error && <p role="alert" className="mt-4 rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">{error}</p>}
      <button onClick={submit} disabled={busy} className="btn btn-primary btn-lg mt-5 w-full">{busy ? "Uploading…" : "Submit payment"}</button>
      <p className="mt-3 text-center text-sm text-muted">After an organiser confirms your payment, your QR ticket is emailed to {user?.email ?? "you"}. It's also in My tickets.</p>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <RequireRole role="student">
      <Checkout />
    </RequireRole>
  );
}
