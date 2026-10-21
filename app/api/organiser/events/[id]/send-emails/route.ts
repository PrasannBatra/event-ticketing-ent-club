import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, requireRole } from "@/lib/server/api";
import { buildRejectionMessage, buildTicketMessage, emailConfigured, sendBatch } from "@/lib/server/email";
import { uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Row = {
  order_id: string; payment_status: string; reject_reason: string | null; ticket_id: string | null; token: string | null; name: string; email: string;
  event_id: string; event_name: string; event_date: string; event_time: string; venue: string;
};

// Sends the next few queued emails (ticket emails for approved payments, reasons for rejected ones) FROM THE APP.
// The screen calls this again and again until `remaining` is 0, which keeps every call short and makes it safe
// to close the tab and carry on later. Body (optional): { retryFailed: true } puts failed emails back in the queue first.
export const POST = handler(async (req, { params }) => {
  const ctx = await authed(req);
  requireRole(ctx, "organiser");
  const eventId = uuid(params.id, "Event");
  let body: { retryFailed?: unknown } = {};
  try { body = await req.json(); } catch { /* no body is fine */ }
  if (!emailConfigured()) throw new ApiError(503, "email_not_configured", "Email isn't set up yet. Students can still open their tickets in My tickets.");

  if (body.retryFailed === true) await ctx.sb.rpc("requeue_failed", { p_event_id: eventId });
  const claimed = await ctx.sb.rpc("claim_emails", { p_event_id: eventId, p_limit: 5 });
  if (claimed.error) throw dbError(claimed.error.message);
  const rows = (claimed.data ?? []) as Row[];

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const items: { id: string; msg: Awaited<ReturnType<typeof buildTicketMessage>> }[] = [];
  const unbuildable: string[] = [];
  for (const r of rows) {
    try {
      if (r.payment_status === "approved") {
        if (!r.token || !r.ticket_id) throw new Error("ticket missing");
        items.push({ id: r.order_id, msg: await buildTicketMessage({ name: r.name, email: r.email, ticketId: r.ticket_id, token: r.token, eventName: r.event_name, eventDate: r.event_date, eventTime: r.event_time, venue: r.venue, siteUrl }) });
      } else {
        items.push({ id: r.order_id, msg: buildRejectionMessage({ name: r.name, email: r.email, eventName: r.event_name, eventId: r.event_id, reason: r.reject_reason, siteUrl }) });
      }
    } catch (e) {
      console.error("couldn't build email:", r.order_id, e);
      unbuildable.push(r.order_id);
    }
  }
  const results = [...(await sendBatch(items)), ...unbuildable.map((id) => ({ id, ok: false }))];
  for (const r of results) await ctx.sb.rpc("finish_email", { p_order_id: r.id, p_ok: r.ok });

  const st = ((await ctx.sb.rpc("event_email_status", { p_event_id: eventId })).data ?? []) as { pending: number; sending: number; failed: number }[];
  return NextResponse.json({
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    remaining: (st[0]?.pending ?? 0) + (st[0]?.sending ?? 0),
    failedTotal: st[0]?.failed ?? 0,
  });
});
