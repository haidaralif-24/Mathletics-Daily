import { SCORING } from './config';

export interface GradeInput {
  isCorrect: boolean;
  /** Sum of ticked mark-scheme criteria. Counts even if the final answer is wrong. */
  stepsPoints: number;
  firstSubmittedAt: Date;
  releaseAt: Date;
}

export interface GradeResult {
  base: number;
  speed: number;
  steps: number;
  total: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** speed = 5 * (1 - elapsed / 24h), 1 decimal, minimum 0. Elapsed uses the FIRST submit time. */
export function speedPoints(firstSubmittedAt: Date, releaseAt: Date): number {
  const elapsed = firstSubmittedAt.getTime() - releaseAt.getTime();
  const raw = SCORING.speedMax * (1 - elapsed / SCORING.windowMs);
  return Math.max(0, round1(raw));
}

/** The ONLY place the formula lives. Used by the admin preview and the save action. */
export function computeGrade(input: GradeInput): GradeResult {
  const base = input.isCorrect ? SCORING.base : 0;
  const speed = input.isCorrect ? speedPoints(input.firstSubmittedAt, input.releaseAt) : 0;
  const steps = Math.min(SCORING.stepsMax, Math.max(0, Math.round(input.stepsPoints)));
  return { base, speed, steps, total: round1(base + speed + steps) };
}
