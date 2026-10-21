"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import RequireRole from "@/components/RequireRole";
import TicketStub from "@/components/TicketStub";

function TicketView() {
  const { id } = useParams<{ id: string }>();
  const { myTickets, getEvent, user } = useStore();
  // Students can only open their own tickets (plan 5.3). Enforced by RLS in production.
  const ticket = myTickets().find((t) => t.id === id);
  const event = ticket ? getEvent(ticket.eventId) : undefined;

  if (!ticket || !event || !user) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-3xl font-semibold">Ticket not found</h1>
        <p className="mt-3 text-muted">This ticket isn't in your account.</p>
        <Link href="/tickets" className="btn btn-dark mt-6">Go to My tickets</Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/tickets" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> My tickets
      </Link>
      <TicketStub ticket={ticket} event={event} user={user} />
    </div>
  );
}

export default function TicketPage() {
  return (
    <RequireRole role="student">
      <TicketView />
    </RequireRole>
  );
}
