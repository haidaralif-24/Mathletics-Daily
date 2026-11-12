import { describe, expect, it } from 'vitest';
import { checkKatexText, describeKatexProblem, scanMath } from '@/components/latex/katex-check';

/**
 * Q-1: "Saving is blocked if KaTeX cannot parse the text." The editor runs this
 * in the browser for fast feedback and `saveQuestion` runs it again server-side,
 * so a crafted request cannot store a body the renderer chokes on. These cover
 * the shared implementation both paths call.
 */

describe('scanMath', () => {
  it('finds inline and block segments', () => {
    const { segments } = scanMath('Nilai $x+1$ dan $$y^2$$ selesai.');
    expect(segments.map((s) => s.source)).toEqual(['x+1', 'y^2']);
    expect(segments[0].displayMode).toBe(false);
    expect(segments[1].displayMode).toBe(true);
  });

  it('reports a block formula that is never closed', () => {
    const { unterminated } = scanMath('Hitung $$x+1 lalu selesai');
    expect(unterminated).toHaveLength(1);
  });

  it('does not treat an escaped dollar as a delimiter', () => {
    const { segments } = scanMath('Harga \\$5 dan $x$ ya');
    expect(segments.map((s) => s.source)).toEqual(['x']);
  });
});

describe('checkKatexText — Q-1 save guard', () => {
  it('accepts plain prose with no maths', () => {
    expect(checkKatexText('Berapa banyak bilangan bulat positif?').ok).toBe(true);
  });

  it('accepts an empty body', () => {
    expect(checkKatexText('').ok).toBe(true);
    expect(checkKatexText('   ').ok).toBe(true);
  });

  it('accepts valid inline and block maths', () => {
    expect(checkKatexText('Nilai $x^2 + \\frac{1}{2}$ dan $$\\sum_{i=1}^{n} i$$').ok).toBe(true);
  });

  it('BLOCKS unparseable maths and names the offending snippet', () => {
    const result = checkKatexText('Hitung $\\frac{1}{$ dulu');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.problems[0].kind).toBe('parse');
    expect(result.problems[0].source).toContain('\\frac');
  });

  it('blocks an unclosed block formula', () => {
    const result = checkKatexText('Hitung $$x+1');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.problems.some((p) => p.kind === 'unterminated')).toBe(true);
  });

  it('still returns the segments it managed to scan when it fails', () => {
    const result = checkKatexText('$x$ then $\\frac{1}{$');
    expect(result.segments.map((s) => s.source)).toEqual(['x', '\\frac{1}{']);
  });

  it('caps how many problems it reports', () => {
    const broken = Array.from({ length: 12 }, () => '$\\frac{1}{$').join(' ');
    const result = checkKatexText(broken);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.problems.length).toBeLessThanOrEqual(5);
  });
});

describe('describeKatexProblem', () => {
  it('writes an Indonesian message for admins', () => {
    const result = checkKatexText('$$x+1');
    if (result.ok) throw new Error('unreachable');
    const text = describeKatexProblem(result.problems[0]);
    expect(text).toMatch(/belum ditutup/);
  });

  it('truncates a very long snippet rather than dumping it into the UI', () => {
    // Concatenated on purpose: inside a template literal `$${...}` is an
    // interpolation, which silently yields a single `$` (inline, never flagged).
    const long = '$$' + 'x'.repeat(400);
    const result = checkKatexText(long);
    if (result.ok) throw new Error('expected an unterminated block problem');
    const text = describeKatexProblem(result.problems[0]);
    expect(text.length).toBeLessThan(200);
    expect(text).toContain('…');
  });
});
