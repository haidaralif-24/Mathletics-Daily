'use server';

import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { fromDatabaseError, fromZodError, ok, type ActionResult } from '@/lib/actions/result';
import type { LeaderboardPeriod, LeaderboardSnapshot } from '@/components/leaderboard/types';

/**
 * L-1..L-5: the leaderboard is read through the caller's RLS-bound client, so the
 * `leaderboard` RPC runs with the member's own token. The function is
 * `security definer`, already excludes admins and inactive members, and never
 * returns answers, photos or feedback (L-5) — this action only reshapes it.
 */
const periodSchema = z.enum(['overall', 'week'], 'Periode papan peringkat tidak dikenal.');

export async function loadLeaderboard(
  period: LeaderboardPeriod = 'overall',
): Promise<ActionResult<LeaderboardSnapshot>> {
  await requireUser();

  const parsed = periodSchema.safeParse(period);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('leaderboard', { p_period: parsed.data });

  if (error) return fromDatabaseError(error);

  const rows = (data ?? []).map((row) => ({
    rank: Number(row.rank),
    userId: row.user_id,
    displayName: row.display_name,
    className: row.class_name,
    totalPoints: Number(row.total_points),
    correctCount: Number(row.correct_count),
    attempted: Number(row.attempted),
    avgSubmitSeconds: row.avg_submit_seconds === null ? null : Number(row.avg_submit_seconds),
  }));

  return ok({ period: parsed.data, rows, updatedAt: new Date().toISOString() });
}
