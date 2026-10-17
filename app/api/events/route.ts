import { NextResponse } from "next/server";
import { ApiError, authed, handler, isFile, MAX_POSTER_BYTES, publicClient, requireRole } from "@/lib/server/api";
import { parseEventInput, sniffImage } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

// Events open to the public. Capacity is never in this list; students only get a sold_out flag.
export const GET = handler(async () => {
  const { data, error } = await publicClient().from("public_events").select("*").order("date");
  if (error) throw new ApiError(500, "server_error", "Couldn't load events.");
  return NextResponse.json({ events: data });
});

// Event creation (organisers only). Goes live as soon as it exists: no approval step.
export const POST = handler(async (req) => {
  const ctx = await authed(req);
  requireRole(ctx, "organiser");
  const form = await req.formData();
  const input = parseEventInput((k) => form.get(k));

  let posterUrl: string | null = null;
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

  const { data, error } = await ctx.sb.from("events").insert({
    name: input.name, description: input.description, date: input.date, time: input.time, venue: input.venue,
    poster_url: posterUrl, ticket_price: input.price, capacity: input.capacity,
    sales_open: input.salesOpen, sales_close: input.salesClose, organiser_id: ctx.userId,
  }).select("id").single();
  if (error || !data) throw new ApiError(500, "server_error", "We couldn't create the event.");
  return NextResponse.json({ id: data.id }, { status: 201 });
});
