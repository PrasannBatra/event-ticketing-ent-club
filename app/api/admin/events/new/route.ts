import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, isFile, MAX_POSTER_BYTES, requireAdmin } from "@/lib/server/api";
import { parseEventInput, sniffImage } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

// Create event (admin)
export const POST = handler(async (req) => {
  const ctx = await authed(req);
  requireAdmin(ctx);
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

  const { data, error } = await ctx.sb.rpc("admin_create_event", {
    p_name: input.name, p_description: input.description, p_date: input.date, p_time: input.time,
    p_venue: input.venue, p_poster_url: posterUrl, p_ticket_price: input.price, p_capacity: input.capacity,
    p_sales_open: input.salesOpen, p_sales_close: input.salesClose,
  });
  if (error) throw dbError(error.message);
  return NextResponse.json({ id: data }, { status: 201 });
});
