import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, requireRole } from "@/lib/server/api";
import { uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

// Match summary for an event: counts of matched/unmatched/verified/rejected orders + txn record count
export const GET = handler(async (req, { params }) => {
  const ctx = await authed(req);
  requireRole(ctx, "organiser");
  const id = uuid(params.id, "Event");
  const { data, error } = await ctx.sb.rpc("match_summary", { p_event_id: id });
  if (error) throw dbError(error.message);
  return NextResponse.json(data ?? { matched: 0, unmatched: 0, verified: 0, rejected: 0, txnRecords: 0 });
});
