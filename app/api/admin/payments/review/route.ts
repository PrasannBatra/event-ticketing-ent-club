import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, requireAdmin } from "@/lib/server/api";
import { uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

// Batch approve/reject payments (admin)
export const POST = handler(async (req) => {
  const ctx = await authed(req);
  requireAdmin(ctx);
  let body: { orderIds?: unknown; approve?: unknown; reason?: unknown };
  try { body = await req.json(); } catch { throw new ApiError(400, "invalid_input", "Send JSON with orderIds and approve."); }
  if (!Array.isArray(body.orderIds) || body.orderIds.length === 0) throw new ApiError(400, "invalid_input", "Choose at least one payment.");
  if (body.orderIds.length > 500) throw new ApiError(400, "too_many", "Choose at most 500 payments at a time.");
  if (typeof body.approve !== "boolean") throw new ApiError(400, "invalid_input", "approve must be true or false.");
  const ids = body.orderIds.map((v) => uuid(v, "Payment"));
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : null;
  const { data, error } = await ctx.sb.rpc("admin_review_payments", { p_order_ids: ids, p_approve: body.approve, p_reason: reason });
  if (error) throw dbError(error.message);
  return NextResponse.json(data);
});
