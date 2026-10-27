import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, requireRole } from "@/lib/server/api";
import { uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

// Run transaction matching for an event: matches student-submitted txn IDs against uploaded CSV records
export const POST = handler(async (req, { params }) => {
  const ctx = await authed(req);
  requireRole(ctx, "organiser");
  const id = uuid(params.id, "Event");
  const { data, error } = await ctx.sb.rpc("match_transactions", { p_event_id: id });
  if (error) throw dbError(error.message);
  return NextResponse.json(data ?? { matched: 0, unmatched: 0 });
});
