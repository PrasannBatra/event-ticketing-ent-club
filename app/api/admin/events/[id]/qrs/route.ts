import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, isFile, requireAdmin } from "@/lib/server/api";
import { sniffImage, text, uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";
const MAX_QR_BYTES = 3 * 1024 * 1024;

// List UPI QR codes for any event (admin)
export const GET = handler(async (req, { params }) => {
  const ctx = await authed(req);
  requireAdmin(ctx);
  const id = uuid(params.id, "Event");
  const { data, error } = await ctx.sb.from("event_upi_qrs").select("id,label,storage_path,created_at").eq("event_id", id).order("created_at");
  if (error) throw new ApiError(500, "server_error", "Couldn't load QR codes.");
  const qrs = (data ?? []).map((q) => ({
    id: q.id,
    label: q.label,
    storage_path: q.storage_path,
    url: ctx.sb.storage.from("upi-qrs").getPublicUrl(q.storage_path).data.publicUrl,
    created_at: q.created_at,
  }));
  return NextResponse.json({ qrs });
});

// Upload a UPI QR code for any event (admin)
export const POST = handler(async (req, { params }) => {
  const ctx = await authed(req);
  requireAdmin(ctx);
  const eventId = uuid(params.id, "Event");
  const form = await req.formData();
  const label = text(form.get("label"), "Label", 0, 60);
  const file = form.get("qr");
  if (!isFile(file) || file.size === 0) throw new ApiError(400, "no_qr", "Upload a QR code image.");
  if (file.size > MAX_QR_BYTES) throw new ApiError(413, "qr_too_large", "The QR image must be under 3 MB.");
  const buf = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(buf);
  if (!kind) throw new ApiError(400, "bad_image", "The QR must be a JPG, PNG or WebP image.");

  const path = `${ctx.userId}/${crypto.randomUUID()}.${kind.ext}`;
  const up = await ctx.sb.storage.from("upi-qrs").upload(path, buf, { contentType: kind.mime });
  if (up.error) throw new ApiError(502, "upload_failed", "We couldn't upload the QR code. Try again.");

  const { data, error } = await ctx.sb.from("event_upi_qrs").insert({ event_id: eventId, label, storage_path: path }).select("id").single();
  if (error) {
    await ctx.sb.storage.from("upi-qrs").remove([path]);
    throw dbError(error.message);
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
});
