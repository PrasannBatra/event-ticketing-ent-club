"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { isAshokaEmail, STUDENT_EMAIL_DOMAIN } from "@/lib/config";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { signUp, signIn, signInWithGoogle, resendConfirmation, signInDemo, resetDemo, demo } = useStore();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const next = params.get("next");
  const go = (role: "student" | "organiser") => router.replace(next && role === "student" ? next : role === "organiser" ? "/organiser" : "/");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isAshokaEmail(email)) return setError(`Use your @${STUDENT_EMAIL_DOMAIN} email address.`);
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    if (mode === "signup" && !name.trim()) return setError("Add your name to create an account.");
    setBusy(true);
    if (mode === "signup") {
      const r = await signUp({ name, email, password });
      setBusy(false);
      if (r.error) return setError(r.error);
      if (r.confirm) return setConfirmSent(r.confirm);
      return go("student");
    }
    const r = await signIn(email, password);
    setBusy(false);
    if (r.error) return setError(r.error);
    go("student"); // organisers are sent to their dashboard by the home page
    router.refresh();
  };

  const google = async () => {
    setError(null);
    setGoogleBusy(true);
    const r = await signInWithGoogle();
    if (r.error) {
      setGoogleBusy(false);
      setError(r.error);
    }
    // On success the browser redirects to Google — nothing else to do here.
  };

  if (confirmSent) {
    return (
      <div className="mx-auto max-w-md py-16 text-center" role="status">
        <MailCheck className="mx-auto h-14 w-14 text-good-fg" aria-hidden />
        <h1 className="mt-6 text-3xl font-semibold">Check your email</h1>
        <p className="mt-3 text-muted">We sent a confirmation link to <b className="text-ink">{confirmSent}</b>. Click it, then come back and sign in.</p>
        <p className="mt-3 text-sm text-muted">Nothing arrived? Check spam, or</p>
        <button className="mt-1 text-sm font-semibold text-ultra underline-offset-4 hover:underline" onClick={async () => { const r = await resendConfirmation(confirmSent); setResendMsg(r.error ?? "Sent again. Check your inbox."); }}>send it again</button>
        {resendMsg && <p role="status" className="mt-2 text-sm text-muted">{resendMsg}</p>}
        <div><button className="btn btn-dark mt-6" onClick={() => { setConfirmSent(null); setMode("signin"); }}>Go to sign in</button></div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-10 py-4 md:grid-cols-2 md:gap-16 md:py-10">
      <div className="md:pt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ashoka-logo-light.png" alt="Ashoka University" className="mb-8 h-14 w-auto" />
        <h1 className="text-5xl font-semibold leading-[0.95] sm:text-6xl">
          {mode === "signin" ? "Sign in to get your ticket" : "Create your account"}
        </h1>
        <p className="mt-5 max-w-sm text-muted">
          Only @{STUDENT_EMAIL_DOMAIN} accounts can sign up. Organisers sign in here too. Students: pay, upload your payment screenshot, and your QR ticket appears once it's approved.
        </p>
      </div>

      <div>
        <button type="button" onClick={google} disabled={googleBusy || busy} className="btn btn-outline w-full btn-lg gap-3">
          {googleBusy ? (
            "Connecting…"
          ) : (
            <>
              <GoogleIcon className="h-5 w-5" aria-hidden />
              Continue with Google
            </>
          )}
        </button>

        <div className="my-6 flex items-center gap-4" aria-hidden>
          <span className="h-px flex-1 bg-line" />
          <span className="text-sm text-muted">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          {mode === "signup" && (
            <div>
              <label htmlFor="name" className="field-label">Full name</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
          )}
          <div>
            <label htmlFor="email" className="field-label">Ashoka email</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`name@${STUDENT_EMAIL_DOMAIN}`} autoComplete="email" />
          </div>
          <div>
            <label htmlFor="pw" className="field-label">Password</label>
            <input id="pw" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
            {mode === "signin" && <Link href="/forgot-password" className="mt-2 inline-block text-sm font-semibold text-ultra underline-offset-4 hover:underline">Forgot your password?</Link>}
          </div>
          {error && <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad-fg">{error}</p>}
          <button type="submit" disabled={busy || googleBusy} className="btn btn-primary w-full btn-lg">
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button className="font-semibold text-ultra underline-offset-4 hover:underline" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}>
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>

        {demo && signInDemo && (
          <section className="mt-10 rounded-2xl border-2 border-dashed border-white/15 p-5" aria-labelledby="demo">
            <h2 id="demo" className="text-base font-semibold">Demo access</h2>
            <p className="mt-1 text-sm text-muted">
              Demo mode: sample data stays in this browser. Connect Supabase (see README) to use the real backend. Organisers are added by other organisers, never self-assigned.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="btn btn-outline !py-2" onClick={() => { signInDemo("student"); go("student"); }}>Enter as student</button>
              <button className="btn btn-outline !py-2" onClick={() => { signInDemo("organiser"); go("organiser"); }}>Enter as organiser</button>
              <button className="btn !py-2 text-muted underline-offset-4 hover:underline" onClick={() => resetDemo?.()}>Reset demo data</button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" fill="#34A853"/>
      <path d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
