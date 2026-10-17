"use client";

import { isSupabaseConfigured } from "./supabase";
import { DemoProvider } from "./store-demo";
import { SupabaseProvider } from "./store-supabase";

export { useStore } from "./store-context";

/** Real Supabase backend when the env vars are set, otherwise the in-browser demo. */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  return isSupabaseConfigured ? <SupabaseProvider>{children}</SupabaseProvider> : <DemoProvider>{children}</DemoProvider>;
}
