import { NextResponse } from "next/server";
import { authed, handler } from "@/lib/server/api";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const { sb, userId } = await authed(req);
  const { data } = await sb.from("profiles").select("*").eq("id", userId).single();
  return NextResponse.json({ user: data });
});
