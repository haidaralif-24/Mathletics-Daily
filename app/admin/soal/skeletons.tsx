import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton untuk halaman admin soal. Loader, empty, dan error state wajib ada di
 * setiap layar (docs/UI_GUIDE.md bagian "States").
 */

export function SoalListSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Memuat daftar soal">
      <span role="status" className="sr-only">
        Memuat daftar soal...
      </span>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-11 w-28 rounded-lg" />
      </div>
      {[0, 1, 2, 3].map((row) => (
        <Skeleton key={row} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Memuat editor soal">
      <span role="status" className="sr-only">
        Memuat editor soal...
      </span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Memuat dasbor admin">
      <span role="status" className="sr-only">
        Memuat dasbor admin...
      </span>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}
