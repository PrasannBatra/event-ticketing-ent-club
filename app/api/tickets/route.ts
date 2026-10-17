import { NextResponse } from "next/server";
import { ApiError, authed, handler } from "@/lib/server/api";

export const dynamic = "force-dynamic";

// My Tickets: only the signed-in student's own tickets (enforced by the database too)
export const GET = handler(async (req) => {
  const ctx = await authed(req);
  const { data, error } = await ctx.sb.from("tickets").select("*").eq("user_id", ctx.userId).order("created_at");
  if (error) throw new ApiError(500, "server_error", "Couldn't load your tickets.");
  return NextResponse.json({ tickets: data });
});
