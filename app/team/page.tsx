"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useStore } from "@/lib/store";
import RequireRole from "@/components/RequireRole";
import type { User } from "@/lib/types";

const roleChip: Record<User["role"], string> = {
  organiser: "bg-accent-soft text-ink",
  student: "bg-line text-muted",
};

function Users() {
  const { listUsers, setUserRole } = useStore();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<User[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => setRows(await listUsers(q)), [listUsers, q]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const change = async (u: User, role: "organiser" | "student") => {
    setBusy(u.id);
    setMsg(await setUserRole(u.email, role));
    await load();
    setBusy(null);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-4xl font-semibold sm:text-5xl">Team</h1>
      <p className="mt-2 text-muted">Choose who can run events. Organisers create events, review payments, scan tickets and export attendees. You can add organisers here; you can't change your own role.</p>

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="q" className="sr-only">Search people</label>
        <input id="q" className="input !h-14 !rounded-full !pl-14 text-base" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {msg && <p role="alert" className="mt-4 rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad-fg">{msg}</p>}

      <ul className="mt-5 divide-y divide-line overflow-hidden rounded-3xl bg-card">
        {rows.length === 0 && <li className="p-8 text-center text-muted">No one found. People appear here after they sign up.</li>}
        {rows.map((u) => (
          <li key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-lg font-medium"><span className="truncate">{u.name}</span><span className={`chip ${roleChip[u.role]}`}>{u.role === "organiser" ? "Organiser" : "Student"}</span></p>
              <p className="truncate text-sm text-muted">{u.email} · {u.studentId}</p>
            </div>
            {u.role === "student" && <button className="btn btn-primary !py-2" disabled={busy === u.id} onClick={() => change(u, "organiser")}>Make organiser</button>}
            {u.role === "organiser" && <button className="btn btn-outline !py-2" disabled={busy === u.id} onClick={() => change(u, "student")}>Make student</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TeamPage() {
  return (
    <RequireRole role="organiser">
      <Users />
    </RequireRole>
  );
}
