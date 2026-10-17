import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, requireRole } from "@/lib/server/api";
import { buildRejectionMessage, buildTicketMessage, emailConfigured, sendMessage } from "@/lib/server/email";
import { uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

type OrderMail = {
  payment_status: string; reject_reason: string | null; ticket_id: string | null; token: string | null; name: string; email: string;
  event_id: string; event_name: string; event_date: string; event_time: string; venue: string;
};

// Ticket issuance. Approving a payment screenshot creates the ticket (with its random QR code) and EMAILS it
// to the student. Rejecting emails them the reason. Safe to repeat: the database ignores a second decision,
// and we only email when this call actually made the decision, so no duplicate emails.
export const POST = handler(async (req, { params }) => {
  const ctx = await authed(req);
  requireRole(ctx, "organiser");
  const orderId = uuid(params.orderId, "Payment");
  let body: { approve?: unknown; reason?: unknown };
  try { body = await req.json(); } catch { throw new ApiError(400, "invalid_input", "Send JSON with approve true or false."); }
  if (typeof body.approve !== "boolean") throw new ApiError(400, "invalid_input", "approve must be true or false.");
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : null;

  const before = ((await ctx.sb.rpc("order_email_data", { p_order_id: orderId })).data as OrderMail[] | null)?.[0];
  const { error } = await ctx.sb.rpc("review_payment", { p_order_id: orderId, p_approve: body.approve, p_reason: reason });
  if (error) throw dbError(error.message);
  if (!before || before.payment_status !== "awaiting_review") return NextResponse.json({ ok: true, email: "skipped" });

  if (!emailConfigured()) return NextResponse.json({ ok: true, email: "not_configured", to: before.email });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  try {
    if (body.approve) {
      const after = ((await ctx.sb.rpc("order_email_data", { p_order_id: orderId })).data as OrderMail[] | null)?.[0];
      if (!after?.token || !after.ticket_id) throw new Error("ticket missing after approval");
      await sendMessage(await buildTicketMessage({
        name: after.name, email: after.email, ticketId: after.ticket_id, token: after.token, eventName: after.event_name,
        eventDate: after.event_date, eventTime: after.event_time, venue: after.venue, siteUrl,
      }));
    } else {
      await sendMessage(buildRejectionMessage({ name: before.name, email: before.email, eventName: before.event_name, eventId: before.event_id, reason, siteUrl }));
    }
    return NextResponse.json({ ok: true, email: "sent", to: before.email });
  } catch (e) {
    console.error("email failed:", e);
    return NextResponse.json({ ok: true, email: "failed", to: before.email });
  }
});
