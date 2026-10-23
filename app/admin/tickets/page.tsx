"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import RequireAdmin from "@/components/RequireAdmin";
import { adminClient, type AdminTicket } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";

const emailChip: Record<string, { label: string; cls: string }> = {
  pending: { label: "Queued", cls: "bg-line text-muted" },
  sending: { label: "Sending", cls: "bg-ultra-soft text-ultra-dark" },
  sent: { label: "Sent", cls: "bg-good-soft text-good-fg" },
  failed: { label: "Failed", cls: "bg-bad-soft text-bad-fg" },
};

function TicketsPage() {
  const [q, setQ] = useState("");
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTickets((await adminClient.tickets(q)).tickets); } catch { setTickets([]); }
    setLoading(false);
  }, [q]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  return (
    <div>
      <h1 className="text-4xl font-semibold sm:text-5xl">Tickets</h1>
      <p className="mt-2 text-muted">All issued tickets with check-in and email delivery status.</p>

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="q" className="sr-only">Search tickets</label>
        <input id="q" className="input !h-14 !rounded-full !pl-14 text-base" placeholder="Search by buyer, email or ticket ID" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="mt-5 overflow-x-auto rounded-3xl bg-card">
        {loading ? <p className="p-8 text-center text-muted">Loading…</p> :
         tickets.length === 0 ? <p className="p-8 text-center text-muted">No tickets found.</p> : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs text-muted"><tr><th className="p-4">Ticket ID</th><th className="p-4">Buyer</th><th className="p-4">Event</th><th className="p-4">Payment</th><th className="p-4">Email</th><th className="p-4">Check-in</th><th className="p-4">Issued</th></tr></thead>
            <tbody className="divide-y divide-line">
              {tickets.map((t) => {
                const em = emailChip[t.email_status] ?? emailChip.pending;
                return (
                  <tr key={t.ticket_id} className="hover:bg-ultra-soft/40">
                    <td className="p-4 font-mono text-xs">{t.ticket_id}</td>
                    <td className="p-4"><p className="font-medium">{t.buyer_name}</p><p className="text-xs text-muted">{t.buyer_email}</p></td>
                    <td className="p-4">{t.event_name}</td>
                    <td className="p-4"><span className={`chip ${t.payment_status === "approved" ? "bg-good-soft text-good-fg" : "bg-warn-soft text-warn-fg"}`}>{t.payment_status === "approved" ? "Approved" : "Pending"}</span></td>
                    <td className="p-4"><span className={`chip ${em.cls}`}>{em.label}</span></td>
                    <td className="p-4"><span className={`chip ${t.status === "used" ? "bg-good-soft text-good-fg" : "bg-ultra-soft text-ultra-dark"}`}>{t.status === "used" ? "Checked in" : "Unused"}</span></td>
                    <td className="p-4 text-muted">{formatDateTime(t.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <RequireAdmin><TicketsPage /></RequireAdmin>;
}
