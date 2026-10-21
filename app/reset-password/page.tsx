"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { PageSkeleton } from "@/components/RequireRole";

// People land here from the link in the reset email. The link signs them in for a moment so they can set a new password.
export default function ResetPasswordPage() {
  const { ready, user, updatePassword } = useStore();
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!ready) return <PageSkeleton />;

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-3xl font-semibold">This link has expired</h1>
        <p className="mt-3 text-muted">Reset links work once and stop working after a while. Ask for a new one.</p>
        <Link href="/forgot-password" className="btn btn-dark mt-6">Get a new link</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md py-20 text-center" role="status">
        <h1 className="text-3xl font-semibold">Password changed</h1>
        <p className="mt-3 text-muted">You're signed in with your new password.</p>
        <button className="btn btn-primary mt-6" onClick={() => router.replace(user.role === "organiser" ? "/organiser" : "/")}>Continue</button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError("Use a password with at least 8 characters.");
    if (pw !== pw2) return setError("The two passwords don't match.");
    setBusy(true);
    const r = await updatePassword(pw);
    setBusy(false);
    if (r.error) return setError(r.error);
    setDone(true);
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-4xl font-semibold">Choose a new password</h1>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <div><label htmlFor="pw" className="field-label">New password</label><input id="pw" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
        <div><label htmlFor="pw2" className="field-label">Repeat new password</label><input id="pw2" type="password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></div>
        {error && <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad-fg">{error}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary btn-lg w-full">{busy ? "Saving…" : "Save new password"}</button>
      </form>
    </div>
  );
}
