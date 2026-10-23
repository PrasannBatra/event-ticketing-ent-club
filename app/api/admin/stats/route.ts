import { NextResponse } from "next/server";
import { authed, dbError, handler, requireAdmin } from "@/lib/server/api";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const ctx = await authed(req);
  requireAdmin(ctx);
  const { data, error } = await ctx.sb.rpc("admin_stats");
  if (error) throw dbError(error.message);
  return NextResponse.json(data);
});
