import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Loading state untuk /admin/member. */
export default function AdminMemberLoading() {
  return (
    <section className="flex flex-col gap-6" aria-busy="true" aria-label="Memuat halaman member">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      <Card>
        <CardHeader className="gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-11 w-full" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-16 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </section>
  );
}
