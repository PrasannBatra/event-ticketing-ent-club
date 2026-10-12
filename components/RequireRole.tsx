"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";

/** Client-side gate for UX only. Real access control is enforced by Supabase row level security (plan 5.3). */
export default function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { ready, user } = useStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [ready, user, router, pathname]);

  if (!ready || !user) return <PageSkeleton />;

  if (user.role !== role) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-3xl font-semibold">{role === "organiser" ? "This page is for organisers" : "This page is for students"}</h1>
        <p className="mt-3 text-muted">
          {role === "organiser"
            ? "Organiser accounts are set up by the team. Ask them to promote your account if you run an event."
            : "You're signed in as an organiser. Sign in with a student account to buy tickets."}
        </p>
        <Link href={user.role === "organiser" ? "/organiser" : "/"} className="btn btn-dark mt-6">
          Go to your home
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6 py-4" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-2/3 rounded-xl bg-line" />
      <div className="h-64 rounded-3xl bg-line" />
    </div>
  );
}
