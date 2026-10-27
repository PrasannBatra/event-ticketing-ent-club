import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, requireRole } from "@/lib/server/api";
import { uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

// List uploaded transaction records for an event
export const GET = handler(async (req, { params }) => {
  const ctx = await authed(req);
  requireRole(ctx, "organiser");
  const id = uuid(params.id, "Event");
  const { data, error } = await ctx.sb.rpc("list_transaction_records", { p_event_id: id });
  if (error) throw dbError(error.message);
  return NextResponse.json({ records: data ?? [] });
});

// Clear all transaction records for an event (before re-uploading a fresh CSV)
export const DELETE = handler(async (req, { params }) => {
  const ctx = await authed(req);
  requireRole(ctx, "organiser");
  const id = uuid(params.id, "Event");
  const { data, error } = await ctx.sb.rpc("clear_transaction_records", { p_event_id: id });
  if (error) throw dbError(error.message);
  return NextResponse.json({ deleted: data ?? 0 });
});
