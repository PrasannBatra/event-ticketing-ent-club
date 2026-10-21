import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, requireRole } from "@/lib/server/api";
import { text, uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

// Ticket validation + check-in. The decision is made by the database in one atomic step, so two
// scanners reading the same QR at the same moment cannot both succeed.
// Result kinds: valid | used (with first scan time) | wrong_event | invalid
export const POST = handler(async (req) => {
  const ctx = await authed(req);
  requireRole(ctx, "organiser");
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { throw new ApiError(400, "invalid_input", "Send JSON with a token and eventId."); }
  const token = text(body.token, "Ticket code", 1, 128);
  const eventId = uuid(body.eventId, "Event");
  const { data, error } = await ctx.sb.rpc("check_in", { p_token: token, p_event_id: eventId });
  if (error) throw dbError(error.message);
  return NextResponse.json(data);
});
