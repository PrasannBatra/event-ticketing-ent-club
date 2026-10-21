import { NextResponse } from "next/server";
import { publicClient } from "@/lib/server/api";

export const dynamic = "force-dynamic";

/** Open /api/health after deploying to check the backend is connected. */
export async function GET() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!configured) return NextResponse.json({ ok: false, configured, database: "Environment variables are missing." }, { status: 503 });
  const { error } = await publicClient().from("public_events").select("id", { head: true, count: "exact" });
  return NextResponse.json({ ok: !error, configured, database: error ? `Can't read the database: ${error.message}. Did you run schema.sql?` : "connected" }, { status: error ? 503 : 200 });
}
