import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading state for the Today screen (docs/UI_GUIDE.md: every screen has one).
 * It stands in for the streamed part of the page while the session and the
 * question are read, and mirrors the real layout so nothing jumps.
 */
export function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      <span className="sr-only">Memuat soal hari ini...</span>

      <div className="flex flex-wrap items-center justify-between gap-2" aria-hidden="true">
        <Skeleton className="h-8 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-28 rounded-4xl" />
          <Skeleton className="h-6 w-32 rounded-4xl" />
        </div>
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10" aria-hidden="true">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="mt-3 h-6 w-3/4" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-11/12" />
        <Skeleton className="mt-2 h-4 w-2/3" />
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10" aria-hidden="true">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-3 h-11 w-full" />
        <Skeleton className="mt-3 h-24 w-full" />
        <Skeleton className="mt-4 h-11 w-28" />
      </div>
    </div>
  );
}
