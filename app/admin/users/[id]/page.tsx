"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import RequireAdmin from "@/components/RequireAdmin";
import { adminClient, type AdminUserDetail } from "@/lib/admin";
import { formatDateTime, formatINR } from "@/lib/format";

const statusChip: Record<string, string> = {
  approved: "bg-good-soft text-good-fg",
  awaiting_review: "bg-warn-soft text-warn-fg",
  rejected: "bg-bad-soft text-bad-fg",
};

function UserDetail({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminClient.userDetail(id).then(setData).catch((e) => setError((e as Error).message));
  }, [id]);

  if (error) return <div className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad-fg">{error}</div>;
  if (!data || !data.user) return <p className="py-8 text-center text-muted">Loading…</p>;

  const u = data.user;

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back</button>

      <div className="rounded-3xl bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-strong text-2xl font-medium text-white">{u.name.charAt(0).toUpperCase()}</div>
          <div>
            <h1 className="text-3xl font-semibold">{u.name}</h1>
            <p className="text-muted">{u.email}</p>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div><dt className="text-sm text-muted">Role</dt><dd className="font-medium capitalize">{u.role}</dd></div>
          <div><dt className="text-sm text-muted">Student ID</dt><dd className="font-medium">{u.student_id || "—"}</dd></div>
          <div><dt className="text-sm text-muted">Joined</dt><dd className="font-medium">{formatDateTime(u.created_at)}</dd></div>
        </dl>
      </div>

      <div>
        <h2 className="mb-3 text-xl font-semibold">Orders ({data.orders.length})</h2>
        {data.orders.length === 0 ? <p className="rounded-2xl bg-card p-6 text-center text-muted">No orders yet.</p> : (
          <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-card">
            {data.orders.map((o) => (
              <li key={o.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link href={`/admin/events/${o.event_id}`} className="font-medium hover:underline">{o.event_name}</Link>
                    <p className="text-sm text-muted">{formatINR(Number(o.amount))} · {formatDateTime(o.created_at)}</p>
                  </div>
                  <span className={`chip ${statusChip[o.payment_status] ?? statusChip.awaiting_review}`}>
                    {o.payment_status === "awaiting_review" ? "Pending" : o.payment_status === "approved" ? "Approved" : "Rejected"}
                  </span>
                </div>
                {o.ticket_id && <p className="mt-1 text-xs text-muted">Ticket: {o.ticket_id}</p>}
                {o.reject_reason && <p className="mt-1 text-xs text-bad-fg">Reason: {o.reject_reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-xl font-semibold">Tickets ({data.tickets.length})</h2>
        {data.tickets.length === 0 ? <p className="rounded-2xl bg-card p-6 text-center text-muted">No tickets yet.</p> : (
          <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-card">
            {data.tickets.map((t) => (
              <li key={t.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link href={`/admin/events/${t.event_id}`} className="font-medium hover:underline">{t.event_name}</Link>
                    <p className="font-mono text-xs text-muted">{t.id}</p>
                  </div>
                  <span className={`chip ${t.status === "used" ? "bg-good-soft text-good-fg" : "bg-ultra-soft text-ultra-dark"}`}>
                    {t.status === "used" ? "Checked in" : "Unused"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function Page({ params }: { params: { id: string } }) {
  return <RequireAdmin><UserDetail id={params.id} /></RequireAdmin>;
}
