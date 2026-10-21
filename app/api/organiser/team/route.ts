import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, requireRole } from "@/lib/server/api";

export const dynamic = "force-dynamic";

// Organisers only: find people by name or email
export const GET = handler(async (req) => {
  const ctx = await authed(req);
  requireRole(ctx, "organiser");
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 100);
  const { data, error } = await ctx.sb.rpc("list_users", { p_search: q });
  if (error) throw dbError(error.message);
  return NextResponse.json({ users: data });
});
