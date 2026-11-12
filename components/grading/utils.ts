import type { Verdict } from '@/lib/answers';
import { formatWib } from '@/lib/time';
import type {
  GradingQuestionOption,
  RosterFilter,
  RosterRow,
  RosterSort,
  RosterStatus,
  SavedGradeInfo,
} from './types';

/**
 * Pure helpers for the grading screen. Kept free of React and of any clock so
 * the roster can be filtered, sorted and counted on the client without a
 * round-trip (R-1, R-4) and so the same mathematics is used everywhere.
 */

export const STATUS_LABELS: Record<RosterStatus, string> = {
  not_submitted: 'Belum kirim',
  ungraded: 'Belum dinilai',
  graded: 'Sudah dinilai',
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  correct: 'Benar',
  wrong: 'Salah',
  needs_review: 'Perlu ditinjau',
};

export const FILTER_LABELS: Record<RosterFilter, string> = {
  all: 'Semua',
  ungraded: 'Belum dinilai',
  graded: 'Sudah dinilai',
  not_submitted: 'Belum kirim',
};

export const SORT_LABELS: Record<RosterSort, string> = {
  submit_asc: 'Waktu kirim (terlama)',
  submit_desc: 'Waktu kirim (terbaru)',
  name: 'Nama (A-Z)',
};

/** R-1: label for the question picker — the WIB release day, never a raw date string. */
export function questionOptionLabel(question: GradingQuestionOption): string {
  return `${formatWib(new Date(question.releaseAt), { timeStyle: undefined })} · ${question.title}`;
}

/**
 * R-2: how far after release the member submitted, in words.
 * Negative values (a submission before release cannot happen) collapse to zero.
 */
export function formatGapSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours > 0) return `${hours} jam ${minutes} menit setelah rilis`;
  if (minutes > 0) return `${minutes} menit setelah rilis`;
  return `${total} detik setelah rilis`;
}

/**
 * R-2: the auto-verdict pre-fills the admin's choice, except `needs_review`
 * (an answer the auto-check could not parse is never silently treated as wrong).
 */
export function prefilledCorrect(autoVerdict: Verdict | null): boolean | null {
  if (autoVerdict === 'correct') return true;
  if (autoVerdict === 'wrong') return false;
  return null;
}

export interface RosterCounts {
  members: number;
  submitted: number;
  graded: number;
  notSubmitted: number;
}

export function rosterCounts(rows: RosterRow[]): RosterCounts {
  let submitted = 0;
  let graded = 0;
  let notSubmitted = 0;

  for (const row of rows) {
    if (row.status === 'not_submitted') notSubmitted += 1;
    else submitted += 1;
    if (row.status === 'graded') graded += 1;
  }

  return { members: rows.length, submitted, graded, notSubmitted };
}

/**
 * R-4: progress reads exactly `12/20 dinilai`. The denominator is the number of
 * submissions received (a member who never submitted can never be graded), and
 * the roster shows the member total next to it so the two are never confused.
 */
export function progressLabel(counts: RosterCounts): string {
  return `${counts.graded}/${counts.submitted} dinilai`;
}

export function filterRoster(rows: RosterRow[], filter: RosterFilter): RosterRow[] {
  if (filter === 'all') return rows;
  return rows.filter((row) => row.status === filter);
}

/** Submit-time sorts put rows without a submission last (they have no submit time). */
export function sortRoster(rows: RosterRow[], sort: RosterSort): RosterRow[] {
  const byName = (a: RosterRow, b: RosterRow) => a.displayName.localeCompare(b.displayName, 'id');

  return [...rows].sort((a, b) => {
    if (sort === 'name') return byName(a, b);

    const aTime = a.firstSubmittedAt ? Date.parse(a.firstSubmittedAt) : null;
    const bTime = b.firstSubmittedAt ? Date.parse(b.firstSubmittedAt) : null;

    if (aTime === null && bTime === null) return byName(a, b);
    if (aTime === null) return 1;
    if (bTime === null) return -1;
    if (aTime === bTime) return byName(a, b);
    return sort === 'submit_asc' ? aTime - bTime : bTime - aTime;
  });
}

/**
 * R-4: the submission to open after saving. Walks the rows in the order the
 * admin sees them (filter then sort) so `Enter` behaves predictably.
 */
export function nextUngradedRow(
  rows: RosterRow[],
  filter: RosterFilter,
  sort: RosterSort,
): RosterRow | null {
  const first = sortRoster(filterRoster(rows, filter), sort).find(
    (row) => row.status === 'ungraded',
  );
  return first ?? null;
}

/** R-5 / R-7: fold a saved grade back into the roster without a refetch. */
export function applyGradeToRoster(
  rows: RosterRow[],
  submissionId: string,
  grade: SavedGradeInfo,
): RosterRow[] {
  return rows.map((row) =>
    row.submissionId === submissionId
      ? {
          ...row,
          status: 'graded',
          totalPoints: grade.totalPoints,
          needsRegrade: grade.needsRegrade,
          gradedByName: grade.gradedByName,
        }
      : row,
  );
}

/** R-1: which question the screen opens on. Deterministic — phases come from the server. */
export function pickDefaultQuestion(options: GradingQuestionOption[]): string | null {
  const open = options.find((option) => option.phase === 'open');
  if (open) return open.id;
  const released = options.find((option) => option.phase === 'released');
  if (released) return released.id;
  return options[0]?.id ?? null;
}
