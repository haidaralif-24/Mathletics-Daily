import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LeaderboardTable } from '@/components/leaderboard/leaderboard-table';
import { LeaderboardSkeleton } from '@/components/leaderboard/skeleton';
import { requireUser } from '@/lib/auth';
import { loadLeaderboard } from './actions';

export const metadata: Metadata = {
  title: 'Papan Peringkat',
  description:
    'Peringkat anggota klub berdasarkan total poin soal yang sudah dinilai. Diperbarui berkala.',
};

/**
 * L-1..L-5: /leaderboard is not under app/admin, so it guards itself with
 * requireUser() — guests go to /login (SPEC section 3). The guard runs inside
 * <Suspense> because `cacheComponents` is on and reading cookies is uncached data.
 */
export default function LeaderboardPage() {
  return (
    <Suspense fallback={<LeaderboardSkeleton />}>
      <LeaderboardSection />
    </Suspense>
  );
}

async function LeaderboardSection() {
  const user = await requireUser();

  // Same action the client polls with, so the first paint and every refresh share
  // one code path (and one authorisation check).
  const initial = await loadLeaderboard('overall');

  return (
    <LeaderboardTable
      currentUserId={user.id}
      isAdmin={user.role === 'admin'}
      initial={initial.ok ? initial.data : null}
      initialError={initial.ok ? null : initial.error.message}
    />
  );
}
