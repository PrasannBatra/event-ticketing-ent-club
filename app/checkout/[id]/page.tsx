"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, Loader2, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import RequireRole from "@/components/RequireRole";
import Poster from "@/components/Poster";
import { formatDate, formatINR, formatTime } from "@/lib/format";
import type { Order, StartOrderResult } from "@/lib/types";

type Step = "review" | "gateway" | "verifying" | "done" | "failed";

const reasons: Record<string, string> = {
  closed: "Ticket sales for this event are closed.",
  upcoming: "Ticket sales haven't opened yet.",
  limit: "You already have a ticket for this event.",
  missing: "We couldn't find this event.",
  role: "Only student accounts can buy tickets.",
  auth: "Please sign in to continue.",
};

function Checkout() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getEvent, startOrder, completePayment, tickets } = useStore();
  const event = getEvent(id);

  const [step, setStep] = useState<Step>("review");
  const [order, setOrder] = useState<Order | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [method, setMethod] = useState("upi");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!event) {
    return <p className="py-24 text-center text-muted">We couldn't find that event. <Link className="font-semibold text-ultra" href="/">Back to events</Link></p>;
  }

  const begin = () => {
    setProblem(null);
    // SERVER: POST /api/orders creates the gateway order after checking the sales window and capacity.
    const res: StartOrderResult = startOrder(event.id);
    if (!res.ok) {
      setProblem(reasons[res.reason]);
      return;
    }
    setOrder(res.order);
    setStep("gateway");
  };

  const pay = (success: boolean) => {
    if (!order) return;
    if (!success) {
      completePayment(order.id, false);
      setStep("failed");
      return;
    }
    setStep("verifying");
    // In production the browser only waits here. The ticket is issued by the server after the
    // gateway's signed webhook arrives; poll GET /api/orders/:id until it reports "paid".
    timer.current = setTimeout(() => {
      const t = completePayment(order.id, true);
      if (t) {
        setTicketId(t.id);
        setStep("done");
      } else setStep("failed");
    }, 1800);
  };

  const existing = tickets.find((t) => t.id === ticketId);

  return (
    <div className="mx-auto max-w-xl">
      {(step === "review" || step === "gateway") && (
        <>
          <h1 className="text-4xl font-semibold">Checkout</h1>
          <div className="mt-6 flex gap-4 rounded-3xl bg-white p-4">
            <div className="h-28 w-24 shrink-0 overflow-hidden rounded-2xl"><Poster event={event} /></div>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold leading-tight">{event.name}</h2>
              <p className="mt-1 text-sm text-muted">{formatDate(event.date)}, {formatTime(event.time)}</p>
              <p className="text-sm text-muted">{event.venue}</p>
            </div>
          </div>
          <dl className="mt-6 space-y-3 rounded-3xl bg-white p-5">
            <div className="flex justify-between"><dt>1 ticket</dt><dd className="font-semibold">{formatINR(event.price)}</dd></div>
            <div className="flex justify-between border-t border-line pt-3 text-lg font-semibold"><dt>Total</dt><dd>{formatINR(event.price)}</dd></div>
          </dl>
        </>
      )}

      {step === "review" && (
        <div className="mt-6">
          {problem && <p role="alert" className="mb-4 rounded-xl bg-bad-soft px-4 py-3 text-sm font-semibold text-bad">{problem}</p>}
          <button onClick={begin} className="btn btn-primary btn-lg w-full">Pay {formatINR(event.price)}</button>
          <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted"><ShieldCheck className="h-4 w-4" aria-hidden /> Your ticket is issued only after your payment is confirmed.</p>
        </div>
      )}

      {step === "gateway" && order && (
        <div className="mt-6 rounded-3xl border-2 border-ink bg-white p-5" role="dialog" aria-label="Payment">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pay {formatINR(order.amount)}</h2>
            <span className="chip bg-warn-soft text-warn-ink">Test mode</span>
          </div>
          <fieldset className="mt-4 space-y-2">
            <legend className="sr-only">Payment method</legend>
            {[["upi", "UPI"], ["card", "Debit or credit card"], ["netbanking", "Net banking"]].map(([v, l]) => (
              <label key={v} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 font-semibold ${method === v ? "border-ultra bg-ultra-soft" : "border-line"}`}>
                <input type="radio" name="method" checked={method === v} onChange={() => setMethod(v)} className="accent-[#F2B83D]" />
                {l}
              </label>
            ))}
          </fieldset>
          <button onClick={() => pay(true)} className="btn btn-primary mt-5 w-full btn-lg">Pay {formatINR(order.amount)}</button>
          <div className="mt-3 flex gap-3">
            <button onClick={() => pay(false)} className="btn btn-outline flex-1 !py-2.5">Simulate failed payment</button>
            <button onClick={() => router.push(`/events/${event.id}`)} className="btn btn-outline flex-1 !py-2.5">Cancel</button>
          </div>
          <p className="mt-4 text-xs text-muted">Placeholder for the Razorpay Checkout window. Replace this panel with the gateway's checkout and keep the steps around it.</p>
        </div>
      )}

      {step === "verifying" && (
        <div className="py-24 text-center" role="status" aria-live="polite">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-ultra" aria-hidden />
          <h1 className="mt-6 text-3xl font-semibold">Confirming your payment</h1>
          <p className="mt-2 text-muted">This takes a few seconds. Please don't close this page.</p>
        </div>
      )}

      {step === "done" && (
        <div className="py-16 text-center" role="status" aria-live="polite">
          <CheckCircle2 className="mx-auto h-16 w-16 text-good" aria-hidden />
          <h1 className="mt-6 text-4xl font-semibold">You're in</h1>
          <p className="mx-auto mt-3 max-w-sm text-muted">Payment confirmed. Your ticket for {event.name} is ready in My tickets.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={`/tickets/${existing?.id ?? ticketId}`} className="btn btn-primary btn-lg">View ticket</Link>
            <Link href="/" className="btn btn-outline btn-lg">Back to events</Link>
          </div>
        </div>
      )}

      {step === "failed" && (
        <div className="py-16 text-center" role="alert">
          <CircleAlert className="mx-auto h-16 w-16 text-bad" aria-hidden />
          <h1 className="mt-6 text-4xl font-semibold">Payment didn't go through</h1>
          <p className="mx-auto mt-3 max-w-sm text-muted">No ticket was created. If money left your account, it will be returned by your bank. You can try again.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button onClick={() => { setStep("review"); setOrder(null); }} className="btn btn-primary btn-lg">Try again</button>
            <Link href={`/events/${event.id}`} className="btn btn-outline btn-lg">Back to event</Link>
          </div>
        </div>
      )}
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
