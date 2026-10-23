import { NextResponse } from "next/server";
import { authed, dbError, handler, requireAdmin } from "@/lib/server/api";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const ctx = await authed(req);
  requireAdmin(ctx);
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const { data, error } = await ctx.sb.rpc("admin_tickets", { p_search: q.slice(0, 100) });
  if (error) throw dbError(error.message);
  return NextResponse.json({ tickets: data });
});
