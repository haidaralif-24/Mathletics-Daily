import { describe, expect, it } from 'vitest';
import { closesAtFor, isOpen, releaseAtFor } from '@/lib/time';

describe('release window', () => {
  const release = releaseAtFor('2026-11-10');
  const closes = closesAtFor(release);

  it('releases at 04:00 WIB = 21:00 UTC the day before', () => {
    expect(release.toISOString()).toBe('2026-11-09T21:00:00.000Z');
  });
  it('closes 24h later', () => expect(closes.toISOString()).toBe('2026-11-10T21:00:00.000Z'));
  it('is open from release up to, but excluding, close', () => {
    expect(isOpen(new Date('2026-11-09T20:59:59.999Z'), release, closes)).toBe(false);
    expect(isOpen(release, release, closes)).toBe(true);
    expect(isOpen(new Date('2026-11-10T20:59:59.999Z'), release, closes)).toBe(true);
    expect(isOpen(closes, release, closes)).toBe(false);
  });
});
