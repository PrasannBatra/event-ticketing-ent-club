import { NextResponse } from "next/server";
import { ApiError, authed, handler, requireRole } from "@/lib/server/api";
import { buildTicketMessage, emailConfigured, sendMessage } from "@/lib/server/email";
import { uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

// Send the ticket email again (for example if it landed in spam or the first send failed)
export const POST = handler(async (req, { params }) => {
  const ctx = await authed(req);
  requireRole(ctx, "organiser");
  const orderId = uuid(params.orderId, "Payment");
  const row = ((await ctx.sb.rpc("order_email_data", { p_order_id: orderId })).data as Record<string, string | null>[] | null)?.[0];
  if (!row) throw new ApiError(404, "order_not_found", "We couldn't find that payment.");
  if (row.payment_status !== "approved" || !row.token || !row.ticket_id) throw new ApiError(409, "not_approved", "Only approved payments have a ticket to send.");
  if (!emailConfigured()) throw new ApiError(503, "email_not_configured", "Email isn't set up yet. The student can open the ticket in My tickets.");
  try {
    await sendMessage(await buildTicketMessage({
      name: row.name as string, email: row.email as string, ticketId: row.ticket_id, token: row.token, eventName: row.event_name as string,
      eventDate: row.event_date as string, eventTime: row.event_time as string, venue: row.venue as string, siteUrl: process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin,
    }));
  } catch (e) {
    console.error("resend failed:", e);
    throw new ApiError(502, "email_failed", "We couldn't send the email. Check the email settings and try again.");
  }
  return NextResponse.json({ ok: true, to: row.email });
});
