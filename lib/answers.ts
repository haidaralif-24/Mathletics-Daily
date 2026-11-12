export type Verdict = 'correct' | 'wrong' | 'needs_review';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '');

/** Parses integers, decimals (dot or comma) and simple fractions like 3/4. Returns null if unparseable. */
export function toNumber(raw: string): number | null {
  const t = norm(raw).replace(',', '.');
  const frac = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(t);
  if (frac) {
    const denominator = Number(frac[2]);
    return denominator === 0 ? null : Number(frac[1]) / denominator;
  }
  return /^-?\d+(?:\.\d+)?$/.test(t) ? Number(t) : null;
}

/** An answer that cannot be parsed is 'needs_review', never 'wrong'. */
export function checkAnswer(input: string, accepted: string[], tolerance = 1e-9): Verdict {
  const a = norm(input);
  if (!a) return 'needs_review';
  if (accepted.some((x) => norm(x) === a)) return 'correct';
  const n = toNumber(a);
  if (n === null) return 'needs_review';
  const acceptedNums = accepted.map(toNumber);
  if (acceptedNums.some((x) => x !== null && Math.abs(x - n) <= tolerance)) return 'correct';
  return acceptedNums.every((x) => x !== null) ? 'wrong' : 'needs_review';
}
