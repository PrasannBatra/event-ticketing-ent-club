"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { PageSkeleton } from "@/components/RequireRole";

export default function AccountPage() {
  const { ready, user, updatePassword, signOut } = useStore();
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (ready && !user) router.replace("/login?next=/account"); }, [ready, user, router]);
  if (!ready || !user) return <PageSkeleton />;

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) return setMsg({ ok: false, text: "Use a password with at least 8 characters." });
    if (pw !== pw2) return setMsg({ ok: false, text: "The two passwords don't match." });
    setBusy(true);
    const r = await updatePassword(pw);
    setBusy(false);
    if (r.error) return setMsg({ ok: false, text: r.error });
    setPw(""); setPw2("");
    setMsg({ ok: true, text: "Password changed." });
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-4xl font-semibold">Your account</h1>
      <dl className="mt-6 divide-y divide-line overflow-hidden rounded-3xl bg-card">
        {[["Name", user.name], ["Ashoka email", user.email], ["Student ID", user.studentId], ["Role", user.role === "organiser" ? "Organiser" : "Student"]].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-5 py-4"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
        ))}
      </dl>

      <h2 className="mt-10 text-2xl font-semibold">Change password</h2>
      <form onSubmit={change} className="mt-4 space-y-4" noValidate>
        <div><label htmlFor="pw" className="field-label">New password</label><input id="pw" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
        <div><label htmlFor="pw2" className="field-label">Repeat new password</label><input id="pw2" type="password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></div>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.ok ? "bg-good-soft text-good-fg" : "bg-bad-soft text-bad-fg"}`}>{msg.text}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary">{busy ? "Saving…" : "Change password"}</button>
      </form>

      <button className="btn btn-outline mt-10" onClick={async () => { await signOut(); router.push("/"); }}>Sign out</button>
    </div>
  );
}
