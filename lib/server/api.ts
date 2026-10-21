import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ValidationError } from "./validate";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024; // Vercel's free plan rejects request bodies over 4.5 MB
export const MAX_POSTER_BYTES = 3 * 1024 * 1024;

const opts = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** Client with no signed-in user: can only read what the public is allowed to read (public_events). */
export function publicClient(): SupabaseClient {
  if (!URL_ || !ANON) throw new ApiError(503, "backend_not_configured", "The backend isn't configured yet.");
  return createClient(URL_, ANON, opts);
}

export interface Ctx {
  sb: SupabaseClient; // acts AS the signed-in user, so the database access rules apply to every query
  userId: string;
  role: "student" | "organiser";
}

/** Reads the Bearer token the browser sends and builds a client that runs as that user. */
export async function authed(req: NextRequest): Promise<Ctx> {
  if (!URL_ || !ANON) throw new ApiError(503, "backend_not_configured", "The backend isn't configured yet.");
  const h = req.headers.get("authorization") ?? "";
  const token = h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
  if (!token) throw new ApiError(401, "not_signed_in", "Please sign in.");
  const sb = createClient(URL_, ANON, { ...opts, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, "not_signed_in", "Your session has expired. Please sign in again.");
  const { data: p } = await sb.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (!p) throw new ApiError(403, "no_profile", "Your account isn't set up yet.");
  return { sb, userId: data.user.id, role: p.role };
}

export function requireRole(ctx: Ctx, role: Ctx["role"]) {
  if (ctx.role !== role) {
    throw new ApiError(403, "forbidden", role === "organiser" ? "Only organisers can do this." : "Only students can do this.");
  }
}

// Messages raised by the database functions in supabase/schema.sql
const DB_ERRORS: Record<string, [number, string]> = {
  not_signed_in: [401, "Please sign in to continue."],
  not_student: [403, "Only student accounts can buy tickets."],
  event_not_found: [404, "We couldn't find this event."],
  sales_not_open: [409, "Ticket sales haven't opened yet."],
  sales_closed: [409, "Ticket sales for this event are closed."],
  sold_out: [409, "Ticket sales for this event are closed."],
  already_has_ticket: [409, "You already have a ticket, or a payment waiting for review, for this event."],
  bad_screenshot_path: [400, "That upload isn't valid."],
  order_not_found: [404, "We couldn't find that payment."],
  not_your_event: [403, "That event belongs to another organiser."],
  not_organiser: [403, "Only organisers can do this."],
  bad_role: [400, "That role isn't allowed."],
  user_not_found: [404, "We couldn't find that person (you can't change your own role)."],
};

export function dbError(message: string): ApiError {
  const key = Object.keys(DB_ERRORS).find((k) => message.includes(k));
  if (key) return new ApiError(DB_ERRORS[key][0], key, DB_ERRORS[key][1]);
  console.error("database error:", message);
  return new ApiError(500, "server_error", "Something went wrong. Please try again.");
}

type RouteCtx = { params: Record<string, string> };

/** Turns thrown errors into clean JSON: { error: { code, message } } */
export function handler(fn: (req: NextRequest, ctx: RouteCtx) => Promise<Response>) {
  return async (req: NextRequest, ctx: RouteCtx): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
      if (e instanceof ValidationError) return NextResponse.json({ error: { code: "invalid_input", field: e.field, message: e.message } }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: { code: "server_error", message: "Something went wrong. Please try again." } }, { status: 500 });
    }
  };
}

export function isFile(v: unknown): v is File {
  return typeof v === "object" && v !== null && "arrayBuffer" in v && "size" in v;
}
