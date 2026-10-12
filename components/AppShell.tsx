"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, LayoutDashboard, LogOut, PlusCircle, ScanLine, Ticket } from "lucide-react";
import { useStore } from "@/lib/store";

const studentNav = [
  { href: "/", label: "Events", icon: CalendarDays },
  { href: "/tickets", label: "My tickets", icon: Ticket },
];
const organiserNav = [
  { href: "/organiser", label: "Events", icon: LayoutDashboard },
  { href: "/organiser/scan", label: "Scan", icon: ScanLine },
  { href: "/organiser/events/new", label: "New event", icon: PlusCircle },
];

function Logo() {
  return (
    <Link href="/" aria-label="Ashoka University, event tickets home" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ashoka-logo.png" alt="Ashoka University" className="h-10 w-auto" />
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, user, signOut } = useStore();
  const pathname = usePathname();
  const router = useRouter();

  const nav = user?.role === "organiser" ? organiserNav : studentNav;
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname.startsWith("/events");
    if (href === "/organiser") return pathname === "/organiser" || (pathname.startsWith("/organiser/events/") && !pathname.endsWith("/new"));
    return pathname.startsWith(href);
  };

  const doSignOut = () => {
    signOut();
    router.push("/");
  };

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pb-2 pt-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {nav.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`rounded-full px-5 py-2.5 text-[15px] font-medium transition-colors ${isActive(href) ? "bg-ink text-white" : "text-ink/70 hover:bg-white/60"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2.5">
          {ready && user ? (
            <>
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted">{user.role === "organiser" ? "Organiser" : "Student"}</p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-full bg-ink text-base font-medium text-white" aria-hidden>
                {user.name.charAt(0).toUpperCase()}
              </span>
              <button onClick={doSignOut} className="grid h-11 w-11 place-items-center rounded-full bg-white/70 hover:bg-white" aria-label="Sign out">
                <LogOut className="h-5 w-5" />
              </button>
            </>
          ) : ready ? (
            <Link href="/login" className="btn btn-primary !py-2.5">Sign in</Link>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-32 pt-4 sm:px-6 md:pb-16 md:pt-8">{children}</main>

      {ready && user && (
        <nav className="fixed inset-x-0 z-30 px-4 md:hidden" style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }} aria-label="Main">
          <ul className="mx-auto flex max-w-sm items-center gap-1 rounded-full bg-ink p-2 shadow-xl">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <li key={href} className={active ? "flex-[2]" : "flex-1"}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    aria-label={label}
                    className={`flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium transition-colors ${active ? "bg-white text-ink" : "text-white/70"}`}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                    {active && label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
