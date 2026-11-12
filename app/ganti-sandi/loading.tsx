import { Skeleton } from '@/components/ui/skeleton';

/** Loading state untuk /ganti-sandi. */
export default function ChangePasswordLoading() {
  return (
    <section
      className="mx-auto flex w-full max-w-sm flex-col gap-6 py-2"
      aria-busy="true"
      aria-label="Memuat halaman ubah kata sandi"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-full" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full rounded-lg" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-11 w-full" />
        </div>
        <Skeleton className="h-11 w-full" />
      </div>
    </section>
  );
}
