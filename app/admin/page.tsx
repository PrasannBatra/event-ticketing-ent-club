"use client";

import { useMemo, useState } from "react";
import { adminClient, type AdminStats } from "@/lib/admin";
import RequireAdmin from "@/components/RequireAdmin";
import { formatINR } from "@/lib/format";
import { Users, Ticket, IndianRupee, Clock, CalendarDays, CheckCircle2, TrendingUp, AlertCircle } from "lucide-react";

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: typeof Users; accent: string }) {
  return (
    <div className="rounded-2xl border border-edge/60 bg-card p-5">
      <div className="flex items-center gap-3">
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${accent}`}><Icon className="h-5 w-5" aria-hidden /></div>
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-sm text-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useMemo(() => {
    adminClient.stats().then(setStats).catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <div className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad-fg">{error}</div>;
  if (!stats) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold sm:text-5xl">Admin dashboard</h1>
        <p className="mt-2 text-muted">Overview of all events, users, tickets and payments across the platform.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Registered users" value={String(stats.total_users)} icon={Users} accent="bg-ultra-soft text-ultra-dark" />
        <StatCard label="Tickets purchased" value={String(stats.total_tickets)} icon={Ticket} accent="bg-accent-soft text-ink" />
        <StatCard label="Total revenue" value={formatINR(Number(stats.total_revenue))} icon={IndianRupee} accent="bg-good-soft text-good-fg" />
        <StatCard label="Pending approvals" value={String(stats.pending_approvals)} icon={Clock} accent="bg-warn-soft text-warn-fg" />
        <StatCard label="Total events" value={String(stats.total_events)} icon={CalendarDays} accent="bg-ultra-soft text-ultra-dark" />
        <StatCard label="Checked in" value={String(stats.checked_in)} icon={CheckCircle2} accent="bg-good-soft text-good-fg" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registrations" value={String(stats.total_registrations)} icon={TrendingUp} accent="bg-accent-soft text-ink" />
        <StatCard label="Approved payments" value={String(stats.approved_orders)} icon={CheckCircle2} accent="bg-good-soft text-good-fg" />
        <StatCard label="Rejected payments" value={String(stats.rejected_orders)} icon={AlertCircle} accent="bg-bad-soft text-bad-fg" />
        <StatCard label="Pending review" value={String(stats.pending_approvals)} icon={Clock} accent="bg-warn-soft text-warn-fg" />
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <RequireAdmin>
      <Dashboard />
    </RequireAdmin>
  );
}

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true">
      <div className="h-10 w-1/3 rounded-xl bg-line" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-line" />)}
      </div>
    </div>
  );
}
