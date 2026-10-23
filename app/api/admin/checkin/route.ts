import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, requireAdmin } from "@/lib/server/api";
import { text, uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

// Check in tickets for any event (admin)
export const POST = handler(async (req) => {
  const ctx = await authed(req);
  requireAdmin(ctx);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { throw new ApiError(400, "invalid_input", "Send JSON with a token and eventId."); }
  const token = text(body.token, "Ticket code", 1, 128);
  const eventId = uuid(body.eventId, "Event");
  const { data, error } = await ctx.sb.rpc("admin_check_in", { p_token: token, p_event_id: eventId });
  if (error) throw dbError(error.message);
  return NextResponse.json(data);
});
