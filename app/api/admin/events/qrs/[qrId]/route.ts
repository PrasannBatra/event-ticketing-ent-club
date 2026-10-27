import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, requireAdmin } from "@/lib/server/api";
import { uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

// Delete a UPI QR code (admin can delete any)
export const DELETE = handler(async (req, { params }) => {
  const ctx = await authed(req);
  requireAdmin(ctx);
  const qrId = uuid(params.qrId, "QR code");
  let body: { storagePath?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  const storagePath = typeof body.storagePath === "string" ? body.storagePath : null;

  const { error } = await ctx.sb.from("event_upi_qrs").delete().eq("id", qrId);
  if (error) throw dbError(error.message);
  if (storagePath) await ctx.sb.storage.from("upi-qrs").remove([storagePath]).catch(() => {});
  return NextResponse.json({ ok: true });
});
