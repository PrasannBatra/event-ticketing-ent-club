import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, requireRole } from "@/lib/server/api";
import { uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

// Delete a UPI QR code (removes from DB + storage)
export const DELETE = handler(async (req, { params }) => {
  const ctx = await authed(req);
  requireRole(ctx, "organiser");
  const qrId = uuid(params.qrId, "QR code");
  let body: { storagePath?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  const storagePath = typeof body.storagePath === "string" ? body.storagePath : null;

  const { data: qr, error: findErr } = await ctx.sb
    .from("event_upi_qrs")
    .select("id,storage_path,event_id")
    .eq("id", qrId)
    .maybeSingle();
  if (findErr || !qr) throw new ApiError(404, "not_found", "We couldn't find that QR code.");
  const { data: event } = await ctx.sb.from("events").select("organiser_id").eq("id", qr.event_id).maybeSingle();
  if (!event || event.organiser_id !== ctx.userId) throw new ApiError(403, "forbidden", "That QR belongs to another organiser's event.");

  const { error } = await ctx.sb.from("event_upi_qrs").delete().eq("id", qrId);
  if (error) throw dbError(error.message);
  if (storagePath) await ctx.sb.storage.from("upi-qrs").remove([storagePath]).catch(() => {});
  return NextResponse.json({ ok: true });
});
