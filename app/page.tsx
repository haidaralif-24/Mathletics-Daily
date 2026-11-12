import { Suspense } from 'react';
import { TodayContent } from '@/components/today/today-content';
import { TodaySkeleton } from '@/components/today/today-skeleton';

/**
 * S-3, S-4: Today's question, for members and guests alike.
 *
 * This file is the prerendered shell only. `<TodayContent />` reads the session
 * cookie and the database, so it lives behind `<Suspense>` — `cacheComponents`
 * is on and runtime data must not block the shell (app/page.tsx is the only
 * route guests can reach, so it has to paint fast).
 *
 * The member view and the guest view are decided in `TodayContent` from
 * `getSessionUser()`; guests are welcome here, `requireUser()` is not used.
 */
export default function Home() {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <TodayContent />
    </Suspense>
  );
}
