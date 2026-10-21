import { NextResponse } from "next/server";
import { ApiError, authed, handler, requireRole } from "@/lib/server/api";
import { uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

// Everything the organiser's event page needs: figures, attendees, and payment screenshots waiting for review
export const GET = handler(async (req, { params }) => {
  const ctx = await authed(req);
  requireRole(ctx, "organiser");
  const id = uuid(params.id, "Event");
  const { data: event } = await ctx.sb.from("events").select("*").eq("id", id).eq("organiser_id", ctx.userId).maybeSingle();
  if (!event) throw new ApiError(404, "event_not_found", "That event doesn't exist, or it belongs to another organiser.");

  const [att, pend, st, em] = await Promise.all([
    ctx.sb.rpc("event_attendees", { p_event_id: id }),
    ctx.sb.rpc("pending_payments", { p_event_id: id }),
    ctx.sb.rpc("organiser_event_stats"),
    ctx.sb.rpc("event_email_status", { p_event_id: id }),
  ]);
  if (att.error || pend.error || st.error || em.error) throw new ApiError(500, "server_error", "Couldn't load this event.");

  // Short-lived links so the organiser can view each private screenshot
  const rows = (pend.data ?? []) as { screenshot_path: string }[];
  const signed = rows.length ? await ctx.sb.storage.from("payment-screenshots").createSignedUrls(rows.map((r) => r.screenshot_path), 3600) : { data: [] };
  const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  const pending = rows.map((r) => ({ ...r, screenshot_url: urls.get(r.screenshot_path) ?? null }));

  return NextResponse.json({
    event,
    stats: ((st.data ?? []) as { event_id: string }[]).find((s) => s.event_id === id) ?? null,
    attendees: att.data,
    pending,
    email: ((em.data ?? []) as { pending: number; sending: number; failed: number; sent: number }[])[0] ?? { pending: 0, sending: 0, failed: 0, sent: 0 },
  });
});
