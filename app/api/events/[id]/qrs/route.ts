import { NextResponse } from "next/server";
import { ApiError, authed, handler } from "@/lib/server/api";
import { uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

// Public list of UPI QR codes for an event (students need to see these at checkout).
export const GET = handler(async (req, { params }) => {
  const ctx = await authed(req);
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
