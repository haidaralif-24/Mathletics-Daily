import { describe, expect, it } from 'vitest';
import { planRecheck, submissionsToUpdate, type RecheckSubmission } from '@/lib/recheck';

/**
 * SPEC section 6, "Wrong key published": fix the key, re-run the auto-check,
 * admin re-confirms affected grades. The point of the re-run is that a corrected
 * key does not silently leave ~40 stored verdicts computed against the old one.
 */

const sub = (id: string, finalAnswer: string, currentVerdict: RecheckSubmission['currentVerdict']): RecheckSubmission => ({
  id,
  finalAnswer,
  currentVerdict,
});

describe('planRecheck', () => {
  it('turns a wrong verdict into correct when the key is fixed', () => {
    const summary = planRecheck([sub('s1', '27', 'wrong')], ['27']);
    expect(summary.decisions[0].next).toBe('correct');
    expect(summary.decisions[0].changed).toBe(true);
    expect(summary.changed).toBe(1);
  });

  it('turns a correct verdict into wrong when the key was wrong in the other direction', () => {
    const summary = planRecheck([sub('s1', '28', 'correct')], ['27']);
    expect(summary.decisions[0].next).toBe('wrong');
    expect(summary.changed).toBe(1);
  });

  it('leaves an unaffected submission alone and does not count it as changed', () => {
    const summary = planRecheck([sub('s1', '27', 'correct')], ['27']);
    expect(summary.changed).toBe(0);
    expect(summariesToUpdateIds(summary)).toEqual([]);
  });

  it('reports needs_review, never wrong, when an answer cannot be parsed', () => {
    const summary = planRecheck([sub('s1', 'tidak tahu', 'wrong')], ['27']);
    expect(summary.decisions[0].next).toBe('needs_review');
    expect(summary.decisions[0].changed).toBe(true);
  });

  it('handles a key that now accepts several answers', () => {
    const summary = planRecheck([sub('s1', '3/4', 'wrong'), sub('s2', '0.75', 'wrong')], ['3/4', '0.75']);
    expect(summary.decisions.map((d) => d.next)).toEqual(['correct', 'correct']);
  });

  it('counts everything it looked at, changed or not', () => {
    // s1 still matches the key; s2 no longer does.
    const summary = planRecheck([sub('s1', '27', 'correct'), sub('s2', '99', 'correct')], ['27']);
    expect(summary.checked).toBe(2);
    expect(summary.changed).toBe(1);
    expect(summariesToUpdateIds(summary)).toEqual(['s2']);
  });

  it('is safe on a question with no submissions', () => {
    expect(planRecheck([], ['27'])).toEqual({ checked: 0, changed: 0, decisions: [] });
  });

  it('records the previous verdict so the admin can be told what moved', () => {
    const summary = planRecheck([sub('s1', '27', 'wrong')], ['27']);
    expect(summary.decisions[0].previous).toBe('wrong');
  });
});

describe('submissionsToUpdate', () => {
  it('returns only the submissions whose verdict moved, so the rest are not re-flagged', () => {
    const summary = planRecheck(
      [sub('s1', '27', 'wrong'), sub('s2', '27', 'correct'), sub('s3', '5', 'wrong')],
      ['27'],
    );
    expect(submissionsToUpdate(summary).map((d) => d.submissionId)).toEqual(['s1']);
  });
});

function summariesToUpdateIds(summary: ReturnType<typeof planRecheck>) {
  return submissionsToUpdate(summary).map((d) => d.submissionId);
}
