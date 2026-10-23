import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, requireAdmin } from "@/lib/server/api";
import { uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

// All orders with optional event/status filters
export const GET = handler(async (req) => {
  const ctx = await authed(req);
  requireAdmin(ctx);
  const sp = new URL(req.url).searchParams;
  const eventId = sp.get("eventId");
  const status = sp.get("status"); // awaiting_review | approved | rejected
  if (status && !["awaiting_review", "approved", "rejected"].includes(status)) {
    throw new ApiError(400, "invalid_input", "Status must be awaiting_review, approved, or rejected.");
  }
  const { data, error } = await ctx.sb.rpc("admin_orders", {
    p_event_id: eventId ? uuid(eventId, "Event") : null,
    p_status: status || null,
  });
  if (error) throw dbError(error.message);

  // Signed URLs for screenshots
  const rows = (data ?? []) as { screenshot_path: string }[];
  const paths = rows.map((r) => r.screenshot_path).filter(Boolean);
  const signed = paths.length ? await ctx.sb.storage.from("payment-screenshots").createSignedUrls(paths, 3600) : { data: [] };
  const urls = new Map((signed.data ?? []).filter((s: any) => s.path && s.signedUrl).map((s: any) => [s.path, s.signedUrl]));
  const orders = rows.map((r: Record<string, unknown>) => ({ ...r, screenshot_url: urls.get((r as { screenshot_path: string }).screenshot_path) ?? null }));

  return NextResponse.json({ orders });
});
