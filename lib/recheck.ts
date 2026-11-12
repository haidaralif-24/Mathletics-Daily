import { checkAnswer, type Verdict } from './answers';

/**
 * SPEC section 6, "Wrong key published": "Fix the key; re-run the auto-check;
 * admin re-confirms affected grades."
 *
 * The auto-check runs once, at submit time, and `auto_verdict` is frozen then —
 * it has to be, because the final answer is locked and a later re-run cannot
 * change what the member wrote. So correcting a key leaves every stored verdict
 * computed against the OLD key, and without this an admin would have to repair
 * each submission by hand.
 *
 * This module is the pure half: given the new key and the stored submissions it
 * says what each verdict should become. Reading and writing the database stays
 * in `lib/actions/recheck.ts`.
 */

export interface RecheckSubmission {
  id: string;
  finalAnswer: string;
  /** The verdict currently stored, so the caller can report what changed. */
  currentVerdict: Verdict | null;
}

export interface RecheckDecision {
  submissionId: string;
  previous: Verdict | null;
  next: Verdict;
  changed: boolean;
}

export interface RecheckSummary {
  checked: number;
  changed: number;
  decisions: RecheckDecision[];
}

/**
 * Recomputes every verdict against the supplied key using the one answer
 * normaliser (`lib/answers.ts` — never a second implementation).
 *
 * A submission whose answer cannot be parsed lands on `needs_review`, never
 * `wrong`, exactly as at submit time.
 */
export function planRecheck(
  submissions: readonly RecheckSubmission[],
  acceptedAnswers: readonly string[],
  tolerance?: number | null,
): RecheckSummary {
  const decisions = submissions.map((submission) => {
    const next = checkAnswer(submission.finalAnswer, [...acceptedAnswers], tolerance ?? undefined);
    return {
      submissionId: submission.id,
      previous: submission.currentVerdict,
      next,
      changed: submission.currentVerdict !== next,
    };
  });

  return {
    checked: decisions.length,
    changed: decisions.filter((decision) => decision.changed).length,
    decisions,
  };
}

/**
 * Only submissions whose verdict actually moved need the admin's attention.
 * Re-flagging every graded submission would bury the real ones.
 */
export function submissionsToUpdate(summary: RecheckSummary): RecheckDecision[] {
  return summary.decisions.filter((decision) => decision.changed);
}
