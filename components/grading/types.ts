import type { Verdict } from '@/lib/answers';

/**
 * DTOs shared by the grading server actions (lib/actions/grading.ts) and the
 * grading screen (components/grading/*). They live in their own module because a
 * `'use server'` file may only export async functions.
 *
 * Everything that crosses the server/client boundary is plain JSON: instants are
 * ISO strings and are always rendered through `formatWib` (AGENTS.md).
 */

/** R-1: the three states an active member can be in for one question. */
export type RosterStatus = 'not_submitted' | 'ungraded' | 'graded';

export interface RosterRow {
  memberId: string;
  displayName: string;
  className: string | null;
  status: RosterStatus;
  /** Null when the member has not submitted (status `not_submitted`). */
  submissionId: string | null;
  firstSubmittedAt: string | null;
  /** R-2: pre-fills the Correct/Wrong choice; `needs_review` never does. */
  autoVerdict: Verdict | null;
  /** R-5 / R-7: stored total of the last grade, if any. */
  totalPoints: number | null;
  /** R-6: the member edited their steps after the grade was written. */
  needsRegrade: boolean;
  /** R-5: who graded last. */
  gradedByName: string | null;
}

export interface GradingRoster {
  questionId: string;
  rows: RosterRow[];
}

export interface GradingPhoto {
  /** Storage path inside `submission-media` (private bucket). */
  path: string;
  /** Short-lived signed URL; null when signing failed. */
  url: string | null;
}

export interface MarkSchemeItem {
  position: number;
  descriptionMd: string;
  points: number;
}

export interface AnswerKeyInfo {
  answerType: string;
  acceptedAnswers: string[];
  tolerance: number | null;
}

export interface SavedGradeInfo {
  isCorrect: boolean;
  basePoints: number;
  speedPoints: number;
  stepsPoints: number;
  totalPoints: number;
  /** Mark-scheme `position` values that are ticked. */
  criteriaTicks: number[];
  privateFeedback: string | null;
  gradedByName: string | null;
  gradedAt: string;
  needsRegrade: boolean;
}

export interface GradingSubmissionInfo {
  id: string;
  questionId: string;
  memberId: string;
  memberName: string;
  className: string | null;
  finalAnswer: string;
  autoVerdict: Verdict | null;
  stepsText: string | null;
  photos: GradingPhoto[];
  firstSubmittedAt: string;
  /** When the member last touched their steps (M-3: steps stay editable). */
  updatedAt: string;
  /** Seconds between release and first submit (R-2). */
  gapSeconds: number;
}

export interface GradingQuestionInfo {
  id: string;
  title: string;
  releaseAt: string;
  closesAt: string;
  answerKey: AnswerKeyInfo | null;
  markScheme: MarkSchemeItem[];
}

export interface GradingItem {
  submission: GradingSubmissionInfo;
  question: GradingQuestionInfo;
  /** Present when the submission already has a grade (R-5, R-7). */
  grade: SavedGradeInfo | null;
}

/** Where a question sits relative to now, decided on the server so the client never reads a clock. */
export type QuestionPhase = 'open' | 'released' | 'upcoming';

export interface GradingQuestionOption {
  id: string;
  title: string;
  /** WIB calendar date, `YYYY-MM-DD`. */
  releaseDate: string;
  releaseAt: string;
  closesAt: string;
  phase: QuestionPhase;
}

export type RosterFilter = 'all' | 'ungraded' | 'graded' | 'not_submitted';
export type RosterSort = 'submit_asc' | 'submit_desc' | 'name';
