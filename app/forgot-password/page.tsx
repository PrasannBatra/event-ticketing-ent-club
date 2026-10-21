"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { isAshokaEmail, STUDENT_EMAIL_DOMAIN } from "@/lib/config";

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useStore();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isAshokaEmail(email)) return setError(`Use your @${STUDENT_EMAIL_DOMAIN} email address.`);
    setBusy(true);
    const r = await requestPasswordReset(email);
    setBusy(false);
    if (r.error) return setError(r.error);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-md py-16 text-center" role="status">
        <MailCheck className="mx-auto h-14 w-14 text-good-fg" aria-hidden />
        <h1 className="mt-6 text-3xl font-semibold">Check your email</h1>
        <p className="mt-3 text-muted">If an account exists for <b className="text-ink">{email}</b>, we've sent a link to choose a new password. It can take a minute, and it may land in spam.</p>
        <Link href="/login" className="btn btn-dark mt-6">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-4xl font-semibold">Reset your password</h1>
      <p className="mt-3 text-muted">Enter your Ashoka email and we'll send you a link to choose a new password.</p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="field-label">Ashoka email</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`name@${STUDENT_EMAIL_DOMAIN}`} autoComplete="email" />
        </div>
        {error && <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad-fg">{error}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary btn-lg w-full">{busy ? "Sending…" : "Send reset link"}</button>
      </form>
      <p className="mt-4 text-center text-sm"><Link href="/login" className="font-semibold text-ultra underline-offset-4 hover:underline">Back to sign in</Link></p>
    </div>
  );
}
