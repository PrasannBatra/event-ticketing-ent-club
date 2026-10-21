import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, requireRole } from "@/lib/server/api";
import { uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

// Ticket issuance for one OR many payment screenshots at once.
//   approve: true  -> each approved screenshot gets a ticket (random QR code) and its email is queued
//   approve: false -> each rejected one is told why (reason) by email
// Each payment is decided on its own: one already decided, or not yours, is skipped and never blocks the rest.
// Repeating a call is harmless: nothing is approved twice and no second ticket is ever created.
// Emails are NOT sent here; the screen then calls /api/organiser/events/:id/send-emails until none are waiting.
export const POST = handler(async (req) => {
  const ctx = await authed(req);
  requireRole(ctx, "organiser");
  let body: { orderIds?: unknown; approve?: unknown; reason?: unknown };
  try { body = await req.json(); } catch { throw new ApiError(400, "invalid_input", "Send JSON with orderIds and approve."); }
  if (!Array.isArray(body.orderIds) || body.orderIds.length === 0) throw new ApiError(400, "invalid_input", "Choose at least one payment.");
  if (body.orderIds.length > 500) throw new ApiError(400, "too_many", "Choose at most 500 payments at a time.");
  if (typeof body.approve !== "boolean") throw new ApiError(400, "invalid_input", "approve must be true or false.");
  const ids = body.orderIds.map((v) => uuid(v, "Payment"));
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : null;
  const { data, error } = await ctx.sb.rpc("review_payments", { p_order_ids: ids, p_approve: body.approve, p_reason: reason });
  if (error) throw dbError(error.message);
  return NextResponse.json(data); // { decided, skipped }
});
