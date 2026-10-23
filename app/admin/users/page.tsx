"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import RequireAdmin from "@/components/RequireAdmin";
import { adminClient, type AdminUser } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";

const roleChip: Record<string, string> = {
  admin: "bg-accent-soft text-ink",
  organiser: "bg-ultra-soft text-ultra-dark",
  student: "bg-line text-muted",
};

function UsersPage() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminClient.users(q);
      setUsers(r.users);
    } catch { setUsers([]); }
    setLoading(false);
  }, [q]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  return (
    <div>
      <h1 className="text-4xl font-semibold sm:text-5xl">Users</h1>
      <p className="mt-2 text-muted">Everyone who has created an account on the platform.</p>

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="q" className="sr-only">Search users</label>
        <input id="q" className="input !h-14 !rounded-full !pl-14 text-base" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="mt-5 overflow-hidden rounded-3xl bg-card">
        {loading ? (
          <p className="p-8 text-center text-muted">Loading…</p>
        ) : users.length === 0 ? (
          <p className="p-8 text-center text-muted">No users found.</p>
        ) : (
          <ul className="divide-y divide-line">
            {users.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="flex items-center gap-4 p-4 transition-colors hover:bg-ultra-soft/60 sm:p-5">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-strong text-base font-medium text-white">{u.name.charAt(0).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium"><span className="truncate">{u.name}</span><span className={`chip ${roleChip[u.role] ?? roleChip.student}`}>{u.role}</span></p>
                    <p className="truncate text-sm text-muted">{u.email}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-medium">{u.ticket_count} tickets</p>
                    <p className="text-xs text-muted">{u.order_count} orders</p>
                  </div>
                  <div className="hidden text-right md:block">
                    <p className="text-xs text-muted">Joined</p>
                    <p className="text-sm">{formatDateTime(u.created_at)}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <RequireAdmin><UsersPage /></RequireAdmin>;
}
