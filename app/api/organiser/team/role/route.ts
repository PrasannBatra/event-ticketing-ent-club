import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, requireRole } from "@/lib/server/api";
import { text } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

// Organisers only: make someone an organiser, or turn them back into a student
export const POST = handler(async (req) => {
  const ctx = await authed(req);
  requireRole(ctx, "organiser");
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { throw new ApiError(400, "invalid_input", "Send JSON with email and role."); }
  const email = text(body.email, "Email", 3, 200);
  const role = body.role;
  if (role !== "organiser" && role !== "student") throw new ApiError(400, "invalid_input", "Role must be organiser or student.");
  const { error } = await ctx.sb.rpc("set_user_role", { p_email: email, p_role: role });
  if (error) throw dbError(error.message);
  return NextResponse.json({ ok: true });
});
