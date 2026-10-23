"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { PageSkeleton } from "@/components/RequireRole";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { ready, user } = useStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [ready, user, router, pathname]);

  if (!ready || !user) return <PageSkeleton />;

  if (user.role !== "admin") {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-3xl font-semibold">Admin access required</h1>
        <p className="mt-3 text-muted">This area is restricted to authorised admins only.</p>
        <Link href={user.role === "organiser" ? "/organiser" : "/"} className="btn btn-dark mt-6">Go to your home</Link>
      </div>
    );
  }
  return <>{children}</>;
}
