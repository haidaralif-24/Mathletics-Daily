import { Skeleton } from '@/components/ui/skeleton';

/** Loading states for the grading screen (docs/UI_GUIDE.md: every screen has one). */

export function RosterSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-3 rounded-lg bg-card p-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-5 w-20 rounded-4xl" />
        </div>
      ))}
    </div>
  );
}

export function GradingItemSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function GradingScreenSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Memuat halaman koreksi">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-[minmax(15rem,18rem)_1fr]">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <RosterSkeleton />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <GradingItemSkeleton />
          </div>
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <GradingItemSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
