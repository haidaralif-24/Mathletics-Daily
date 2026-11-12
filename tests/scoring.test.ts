import { describe, expect, it } from 'vitest';
import { computeGrade, speedPoints } from '@/lib/scoring';

const release = new Date('2026-11-09T21:00:00.000Z');
const at = (hours: number) => new Date(release.getTime() + hours * 3_600_000);

describe('speedPoints', () => {
  it('gives full points at release', () => expect(speedPoints(release, release)).toBe(5));
  it('halves at 12h', () => expect(speedPoints(at(12), release)).toBe(2.5));
  it('is zero at 24h and never negative', () => {
    expect(speedPoints(at(24), release)).toBe(0);
    expect(speedPoints(at(30), release)).toBe(0);
  });
});

describe('computeGrade', () => {
  it('adds base, speed and steps for a correct answer', () => {
    expect(computeGrade({ isCorrect: true, stepsPoints: 3, firstSubmittedAt: at(12), releaseAt: release }))
      .toEqual({ base: 10, speed: 2.5, steps: 3, total: 15.5 });
  });
  it('still awards steps when wrong, but no base or speed', () => {
    expect(computeGrade({ isCorrect: false, stepsPoints: 4, firstSubmittedAt: at(1), releaseAt: release }))
      .toEqual({ base: 0, speed: 0, steps: 4, total: 4 });
  });
  it('caps at 20', () => {
    expect(computeGrade({ isCorrect: true, stepsPoints: 99, firstSubmittedAt: release, releaseAt: release }).total).toBe(20);
  });
});
