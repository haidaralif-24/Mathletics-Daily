import Link from "next/link";
import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth";
import { NavLinks } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Kerangka aplikasi: header, navigasi per peran, dan area konten.
 * Server Component — hanya NavLinks dan ThemeToggle yang dikirim ke klien.
 * Data sesi diambil oleh <AppShellUser /> di dalam <Suspense> (app/layout.tsx).
 */
export function AppShell({
  user,
  children,
}: {
  user: SessionUser | null;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#konten"
        className="absolute top-3 left-3 z-50 -translate-y-24 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground outline-none transition-transform focus:translate-y-0 focus:ring-3 focus:ring-ring/50"
      >
        Lewati ke konten
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-1.5">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 rounded-lg pr-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-md bg-primary font-heading text-[0.7rem] font-bold tracking-wide text-primary-foreground"
            >
              MD
            </span>
            <span className="font-heading text-base font-semibold tracking-tight text-foreground">
              Mathletics Daily
            </span>
          </Link>

          <div className="flex min-w-0 items-center gap-1">
            {user ? (
              <span className="hidden max-w-36 truncate text-sm text-muted-foreground sm:block">
                {user.displayName}
              </span>
            ) : null}
            <ThemeToggle />
          </div>
        </div>

        <NavLinks role={user?.role ?? null} />
      </header>

      <main
        id="konten"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:py-8"
      >
        {children}
      </main>
    </div>
  );
}

/**
 * Fallback Suspense selama sesi dibaca dari cookie (Partial Prerendering).
 * Tingginya menyerupai shell asli supaya tidak ada lompatan layout.
 */
export function AppShellSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <span role="status" className="sr-only">
        Memuat halaman…
      </span>
      <header className="border-b border-border" aria-hidden="true">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-1.5">
          <div className="flex min-h-11 items-center gap-2">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="size-11 rounded-lg" />
        </div>
        <div className="border-t border-border/70">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-1 px-4 py-2">
            <Skeleton className="h-11 w-20" />
            <Skeleton className="h-11 w-32" />
            <Skeleton className="h-11 w-16" />
          </div>
        </div>
      </header>
      <main
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6"
        aria-hidden="true"
      >
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </main>
    </div>
  );
}