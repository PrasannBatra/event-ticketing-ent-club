import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** When these two variables are missing the app runs in demo mode on sample data. */
export const isSupabaseConfigured = Boolean(url && key);

export const supabase = createClient(url ?? "http://localhost:54321", key ?? "anon-key-not-set");
