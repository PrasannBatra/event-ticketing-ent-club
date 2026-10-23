import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, isFile, MAX_POSTER_BYTES, requireAdmin } from "@/lib/server/api";
import { parseEventInput, sniffImage, uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

// Get single event detail (admin)
export const GET = handler(async (req, { params }) => {
  const ctx = await authed(req);
  requireAdmin(ctx);
  const id = uuid(params.id, "Event");
  const { data: events } = await ctx.sb.rpc("admin_all_events");
  const event = (events ?? []).find((e: { id: string }) => e.id === id);
  if (!event) throw new ApiError(404, "event_not_found", "We couldn't find this event.");
  const [stats, attendees, pending, emailSt] = await Promise.all([
    ctx.sb.rpc("admin_event_stats", { p_event_id: id }),
    ctx.sb.rpc("admin_event_attendees", { p_event_id: id }),
    ctx.sb.rpc("admin_pending_payments", { p_event_id: id }),
    ctx.sb.rpc("admin_event_email_status", { p_event_id: id }),
  ]);
  // Signed URLs for pending screenshots
  const rows = (pending.data ?? []) as { screenshot_path: string }[];
  const paths = rows.map((r) => r.screenshot_path).filter(Boolean);
  const signed = paths.length ? await ctx.sb.storage.from("payment-screenshots").createSignedUrls(paths, 3600) : { data: [] };
  const urls = new Map((signed.data ?? []).filter((s: any) => s.path && s.signedUrl).map((s: any) => [s.path, s.signedUrl]));
  const pendingWithUrls = rows.map((r: Record<string, unknown>) => ({ ...r, screenshot_url: urls.get((r as { screenshot_path: string }).screenshot_path) ?? null }));
  return NextResponse.json({
    event,
    stats: stats.data,
    attendees: attendees.data,
    pending: pendingWithUrls,
    email: (emailSt.data ?? [])[0] ?? { pending: 0, sending: 0, failed: 0, sent: 0 },
  });
});

// Update event (admin)
export const PUT = handler(async (req, { params }) => {
  const ctx = await authed(req);
  requireAdmin(ctx);
  const id = uuid(params.id, "Event");
  const form = await req.formData();
  const input = parseEventInput((k) => form.get(k));

  // Keep existing poster if no new one uploaded
  let posterUrl = String(form.get("posterUrl") || "");
  const poster = form.get("poster");
  if (isFile(poster) && poster.size > 0) {
    if (poster.size > MAX_POSTER_BYTES) throw new ApiError(413, "poster_too_large", "The poster must be under 3 MB.");
    const buf = new Uint8Array(await poster.arrayBuffer());
    const kind = sniffImage(buf);
    if (!kind) throw new ApiError(400, "bad_image", "The poster must be a JPG, PNG or WebP image.");
    const path = `${ctx.userId}/${crypto.randomUUID()}.${kind.ext}`;
    const up = await ctx.sb.storage.from("posters").upload(path, buf, { contentType: kind.mime });
    if (up.error) throw new ApiError(502, "upload_failed", "We couldn't upload the poster. Try again.");
    posterUrl = ctx.sb.storage.from("posters").getPublicUrl(path).data.publicUrl;
  }

  const published = form.get("published") !== "false";
  const archived = form.get("archived") === "true";

  const { error } = await ctx.sb.rpc("admin_update_event", {
    p_event_id: id,
    p_name: input.name, p_description: input.description, p_date: input.date, p_time: input.time,
    p_venue: input.venue, p_poster_url: posterUrl || null, p_ticket_price: input.price, p_capacity: input.capacity,
    p_sales_open: input.salesOpen, p_sales_close: input.salesClose, p_published: published, p_archived: archived,
  });
  if (error) throw dbError(error.message);
  return NextResponse.json({ ok: true });
});

// Archive event (admin)
export const DELETE = handler(async (req, { params }) => {
  const ctx = await authed(req);
  requireAdmin(ctx);
  const id = uuid(params.id, "Event");
  const { error } = await ctx.sb.rpc("admin_delete_event", { p_event_id: id });
  if (error) throw dbError(error.message);
  return NextResponse.json({ ok: true });
});
