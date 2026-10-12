"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { STUDENT_EMAIL_DOMAIN } from "@/lib/config";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { signInWithEmail, emailExists, signInDemo, resetDemo } = useStore();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const next = params.get("next");
  const go = (role: "student" | "organiser") => router.replace(next && role === "student" ? next : role === "organiser" ? "/organiser" : "/");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    if (password.length < 6) return setError("Use a password with at least 6 characters.");
    if (mode === "signup" && (!name.trim() || !studentId.trim())) return setError("Add your name and student ID to create an account.");
    if (mode === "signin" && !emailExists(email)) return setError("We can't find an account with that email. Create an account first so we can record your name and student ID.");
    // Replace with supabase.auth.signInWithPassword / signUp.
    const u = signInWithEmail({ email, name, studentId });
    go(u.role);
  };

  const google = () => {
    // Replace with supabase.auth.signInWithOAuth({ provider: "google", options: { queryParams: { hd: STUDENT_EMAIL_DOMAIN } } })
    signInDemo("student");
    go("student");
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-10 py-4 md:grid-cols-2 md:gap-16 md:py-10">
      <div className="md:pt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ashoka-logo.png" alt="Ashoka University" className="mb-8 h-14 w-auto" />
        <h1 className="text-5xl font-semibold leading-[0.95] sm:text-6xl">
          {mode === "signin" ? "Sign in to get your ticket" : "Create your account"}
        </h1>
        <p className="mt-5 max-w-sm text-muted">
          Your ticket is a QR code on your phone. Pay online, show it at the gate, walk in.
        </p>
      </div>

      <div>
        <button onClick={google} className="btn btn-dark w-full btn-lg">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-sm font-semibold text-ink" aria-hidden>G</span>
          Continue with your @{STUDENT_EMAIL_DOMAIN} account
        </button>

        <div className="my-6 flex items-center gap-4 text-sm text-muted" role="separator">
          <span className="h-px flex-1 bg-line" /> or use email <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          {mode === "signup" && (
            <>
              <div>
                <label htmlFor="name" className="field-label">Full name</label>
                <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
              <div>
                <label htmlFor="sid" className="field-label">Student ID</label>
                <input id="sid" className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="AU2026-1042" />
              </div>
            </>
          )}
          <div>
            <label htmlFor="email" className="field-label">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <label htmlFor="pw" className="field-label">Password</label>
            <input id="pw" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
          </div>
          {error && <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-semibold text-bad">{error}</p>}
          <button type="submit" className="btn btn-primary w-full btn-lg">{mode === "signin" ? "Sign in" : "Create account"}</button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button className="font-semibold text-ultra underline-offset-4 hover:underline" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}>
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>

        <section className="mt-10 rounded-2xl border-2 border-dashed border-ultra/30 p-5" aria-labelledby="demo">
          <h2 id="demo" className="text-base font-semibold">Demo access</h2>
          <p className="mt-1 text-sm text-muted">
            This build runs on sample data in your browser. In production, organiser accounts are promoted by the team, never self-assigned.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn btn-outline !py-2" onClick={() => { signInDemo("student"); go("student"); }}>Enter as student</button>
            <button className="btn btn-outline !py-2" onClick={() => { signInDemo("organiser"); go("organiser"); }}>Enter as organiser</button>
            <button className="btn !py-2 text-muted underline-offset-4 hover:underline" onClick={() => resetDemo()}>Reset demo data</button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
