import { NextResponse } from "next/server";
import { ApiError, authed, handler, requireRole } from "@/lib/server/api";

export const dynamic = "force-dynamic";

// The organiser's own events (including capacity) with sales figures
export const GET = handler(async (req) => {
  const ctx = await authed(req);
  requireRole(ctx, "organiser");
  const [ev, st] = await Promise.all([
    ctx.sb.from("events").select("*").eq("organiser_id", ctx.userId).order("date"),
    ctx.sb.rpc("organiser_event_stats"),
  ]);
  if (ev.error || st.error) throw new ApiError(500, "server_error", "Couldn't load your events.");
  return NextResponse.json({ events: ev.data, stats: st.data });
});
