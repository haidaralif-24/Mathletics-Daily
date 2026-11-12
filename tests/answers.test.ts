import { describe, expect, it } from 'vitest';
import { checkAnswer } from '@/lib/answers';

describe('checkAnswer', () => {
  it('ignores spaces and case', () => expect(checkAnswer(' 12 ', ['12'])).toBe('correct'));
  it('treats fractions and decimals as equal', () => {
    expect(checkAnswer('3/4', ['0.75'])).toBe('correct');
    expect(checkAnswer('0,75', ['3/4'])).toBe('correct');
  });
  it('marks a different number wrong', () => expect(checkAnswer('5', ['6'])).toBe('wrong'));
  it('accepts an exact text match', () => expect(checkAnswer('sqrt(2)', ['sqrt(2)'])).toBe('correct'));
  it('sends unparseable input to review, not wrong', () => {
    expect(checkAnswer('sqrt(2)', ['2'])).toBe('needs_review');
    expect(checkAnswer('', ['2'])).toBe('needs_review');
  });
});
