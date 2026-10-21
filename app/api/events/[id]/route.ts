import { NextResponse } from "next/server";
import { ApiError, handler, publicClient } from "@/lib/server/api";
import { uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

export const GET = handler(async (_req, { params }) => {
  const id = uuid(params.id, "Event");
  const { data } = await publicClient().from("public_events").select("*").eq("id", id).maybeSingle();
  if (!data) throw new ApiError(404, "event_not_found", "We couldn't find this event.");
  return NextResponse.json({ event: data });
});
