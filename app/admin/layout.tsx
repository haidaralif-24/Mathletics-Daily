import { Suspense } from 'react';
import { requireAdmin } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Admin-area guard. The authoritative role check lives here (a database read
 * through RLS in `requireAdmin`), not in proxy.ts — a stale JWT must never be
 * the only thing standing between a member and the answer keys.
 *
 * The check runs inside Suspense because `cacheComponents` is on: reading
 * cookies is uncached data, so it cannot be part of the prerendered shell.
 */
async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}

function AdminFallback() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Memuat halaman admin">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
