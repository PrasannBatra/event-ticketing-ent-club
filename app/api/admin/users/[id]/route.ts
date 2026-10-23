import { NextResponse } from "next/server";
import { authed, dbError, handler, requireAdmin } from "@/lib/server/api";
import { uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

export const GET = handler(async (req, { params }) => {
  const ctx = await authed(req);
  requireAdmin(ctx);
  const id = uuid(params.id, "User");
  const { data, error } = await ctx.sb.rpc("admin_user_detail", { p_user_id: id });
  if (error) throw dbError(error.message);
  return NextResponse.json(data);
});
