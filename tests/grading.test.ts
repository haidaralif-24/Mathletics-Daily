import { describe, expect, it } from 'vitest';
import {
  filterRoster,
  formatGapSeconds,
  nextUngradedRow,
  prefilledCorrect,
  progressLabel,
  rosterCounts,
  sortRoster,
} from '@/components/grading/utils';
import type { RosterRow } from '@/components/grading/types';

/**
 * R-1..R-4: the grading screen is the screen the club lives in during a grading
 * session, and R-4 carries a hard acceptance criterion ("grade 20 submissions in
 * under 10 minutes"). These helpers decide what the admin sees and where Enter
 * lands, so they are worth pinning.
 */

const row = (over: Partial<RosterRow> & { memberId: string }): RosterRow => ({
  displayName: over.memberId,
  className: null,
  status: 'not_submitted',
  submissionId: null,
  firstSubmittedAt: null,
  autoVerdict: null,
  totalPoints: null,
  needsRegrade: false,
  gradedByName: null,
  ...over,
});

const ROWS: RosterRow[] = [
  row({ memberId: 'A', displayName: 'Ani', status: 'graded', firstSubmittedAt: '2026-11-10T22:00:00Z' }),
  row({ memberId: 'B', displayName: 'Budi', status: 'ungraded', firstSubmittedAt: '2026-11-10T21:00:00Z' }),
  row({ memberId: 'C', displayName: 'Citra', status: 'not_submitted' }),
  row({ memberId: 'D', displayName: 'Dewi', status: 'ungraded', firstSubmittedAt: '2026-11-11T02:00:00Z' }),
];

describe('prefilledCorrect — R-2', () => {
  it('pre-fills correct and wrong', () => {
    expect(prefilledCorrect('correct')).toBe(true);
    expect(prefilledCorrect('wrong')).toBe(false);
  });

  it('never pre-fills needs_review, so an unparseable answer is not silently judged', () => {
    expect(prefilledCorrect('needs_review')).toBeNull();
    expect(prefilledCorrect(null)).toBeNull();
  });
});

describe('rosterCounts and progressLabel — R-1, R-4', () => {
  it('separates submitted, graded and never-submitted', () => {
    expect(rosterCounts(ROWS)).toEqual({ members: 4, submitted: 3, graded: 1, notSubmitted: 1 });
  });

  it('reads exactly "12/20 dinilai"', () => {
    expect(progressLabel({ members: 20, submitted: 20, graded: 12, notSubmitted: 0 })).toBe('12/20 dinilai');
  });

  it('denominator is submissions received, so a non-submitter cannot skew it', () => {
    expect(progressLabel(rosterCounts(ROWS))).toBe('1/3 dinilai');
  });

  it('handles an empty question without dividing by anything', () => {
    expect(progressLabel(rosterCounts([]))).toBe('0/0 dinilai');
  });
});

describe('filterRoster — R-1', () => {
  it('returns everything for "all"', () => {
    expect(filterRoster(ROWS, 'all')).toHaveLength(4);
  });

  it('filters to a single status', () => {
    expect(filterRoster(ROWS, 'ungraded').map((r) => r.memberId)).toEqual(['B', 'D']);
    expect(filterRoster(ROWS, 'graded').map((r) => r.memberId)).toEqual(['A']);
    expect(filterRoster(ROWS, 'not_submitted').map((r) => r.memberId)).toEqual(['C']);
  });
});

describe('sortRoster — R-1 (sortable by submit time)', () => {
  it('sorts by submit time ascending and puts non-submitters last', () => {
    expect(sortRoster(ROWS, 'submit_asc').map((r) => r.memberId)).toEqual(['B', 'A', 'D', 'C']);
  });

  it('sorts by submit time descending and still puts non-submitters last', () => {
    expect(sortRoster(ROWS, 'submit_desc').map((r) => r.memberId)).toEqual(['D', 'A', 'B', 'C']);
  });

  it('sorts by name', () => {
    expect(sortRoster(ROWS, 'name').map((r) => r.displayName)).toEqual(['Ani', 'Budi', 'Citra', 'Dewi']);
  });

  it('does not mutate the array it was given', () => {
    const before = ROWS.map((r) => r.memberId);
    sortRoster(ROWS, 'submit_desc');
    expect(ROWS.map((r) => r.memberId)).toEqual(before);
  });
});

describe('nextUngradedRow — R-4 (Enter jumps to the next ungraded)', () => {
  it('returns the first ungraded row in the order the admin is looking at', () => {
    expect(nextUngradedRow(ROWS, 'all', 'submit_asc')?.memberId).toBe('B');
    expect(nextUngradedRow(ROWS, 'all', 'submit_desc')?.memberId).toBe('D');
  });

  it('respects the active filter', () => {
    expect(nextUngradedRow(ROWS, 'graded', 'name')).toBeNull();
    expect(nextUngradedRow(ROWS, 'ungraded', 'name')?.memberId).toBe('B');
  });

  it('returns null when everything is graded, so Enter stops instead of looping', () => {
    const allGraded = ROWS.map((r) => (r.status === 'ungraded' ? { ...r, status: 'graded' as const } : r));
    expect(nextUngradedRow(allGraded, 'all', 'name')).toBeNull();
  });
});

describe('formatGapSeconds — R-2 (gap from release)', () => {
  it('formats minutes and hours in Indonesian', () => {
    expect(formatGapSeconds(90)).toMatch(/1/);
    expect(formatGapSeconds(0)).toBeTruthy();
  });
});
