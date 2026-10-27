import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, isFile, MAX_SCREENSHOT_BYTES, requireRole } from "@/lib/server/api";
import { sniffImage, uuid, UUID_RE } from "@/lib/server/validate";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";
const uuidRegex = UUID_RE;

// The signed-in student's own payment submissions
export const GET = handler(async (req) => {
  const ctx = await authed(req);
  const { data, error } = await ctx.sb.from("orders").select("*").eq("user_id", ctx.userId).order("created_at");
  if (error) throw new ApiError(500, "server_error", "Couldn't load your payments.");
  return NextResponse.json({ orders: data });
});

// Order creation: the student sends the event, a payment screenshot, and optionally a UPI transaction ID and selected QR.
// The screenshot is checked and stored here; the database function create_order then enforces
// the sales window, capacity and the one-ticket limit in a single locked step.
export const POST = handler(async (req) => {
  const ctx = await authed(req);
  requireRole(ctx, "student");
  const form = await req.formData();
  const eventId = uuid(form.get("eventId"), "Event");
  const file = form.get("screenshot");
  if (!isFile(file) || file.size === 0) throw new ApiError(400, "no_screenshot", "Upload your payment screenshot.");
  if (file.size > MAX_SCREENSHOT_BYTES) throw new ApiError(413, "screenshot_too_large", "That screenshot is too large. Choose one under 4 MB.");
  const buf = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(buf);
  if (!kind) throw new ApiError(400, "bad_image", "The screenshot must be a JPG, PNG or WebP image.");

  const txnId = typeof form.get("txnId") === "string" ? (form.get("txnId") as string).trim().slice(0, 60) : null;
  const upiQrRaw = form.get("upiQrId");
  const upiQrId = upiQrRaw && typeof upiQrRaw === "string" && uuidRegex.test(upiQrRaw) ? upiQrRaw : null;

  const hash = createHash("sha256").update(buf).digest("hex"); // lets organisers spot the same screenshot used twice
  const orderId = crypto.randomUUID();
  const path = `${ctx.userId}/${orderId}.${kind.ext}`;
  const up = await ctx.sb.storage.from("payment-screenshots").upload(path, buf, { contentType: kind.mime });
  if (up.error) throw new ApiError(502, "upload_failed", "We couldn't upload your screenshot. Check your connection and try again.");

  const { error } = await ctx.sb.rpc("create_order", {
    p_order_id: orderId, p_event_id: eventId, p_screenshot_path: path,
    p_screenshot_hash: hash, p_txn_id: txnId, p_upi_qr_id: upiQrId,
  });
  if (error) {
    await ctx.sb.storage.from("payment-screenshots").remove([path]); // best effort
    throw dbError(error.message);
  }
  return NextResponse.json({ orderId }, { status: 201 });
});
