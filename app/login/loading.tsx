import { Skeleton } from '@/components/ui/skeleton';

/** Loading state untuk /login (docs/UI_GUIDE.md: setiap layar punya skeleton). */
export default function LoginLoading() {
  return (
    <section
      className="mx-auto flex w-full max-w-sm flex-col gap-6 py-2"
      aria-busy="true"
      aria-label="Memuat halaman masuk"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full" />
        </div>
        <Skeleton className="h-11 w-full" />
      </div>
    </section>
  );
}
