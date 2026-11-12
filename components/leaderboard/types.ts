/**
 * Leaderboard DTOs. They live outside `app/leaderboard/actions.ts` because a
 * `'use server'` file may only export async functions.
 */

/** L-1: only 'overall' is live; 'week' is the [P1] tab the RPC already supports. */
export type LeaderboardPeriod = 'overall' | 'week';

export interface LeaderboardRow {
  rank: number;
  /** Used to highlight and pin the caller's own row (L-3). */
  userId: string;
  displayName: string;
  className: string | null;
  totalPoints: number;
  correctCount: number;
  attempted: number;
  /** Tie-break input of the RPC (L-2); shown as a quiet detail, never as a verdict. */
  avgSubmitSeconds: number | null;
}

export interface LeaderboardSnapshot {
  period: LeaderboardPeriod;
  rows: LeaderboardRow[];
  /** Server time of this snapshot, so the screen can show when it last refreshed. */
  updatedAt: string;
}
