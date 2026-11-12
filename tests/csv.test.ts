import { describe, expect, it } from 'vitest';
import { parseCsv, parseRosterCsv } from '@/lib/csv';

/**
 * U-1 and SPEC section 6: "CSV has a duplicate or invalid email -> Row skipped
 * and reported; others imported". The property that matters is that ONE bad row
 * never costs the rest of the roster, so most of these assert on the survivors
 * as much as on the rejects.
 */

const HEADER = 'email,nama,kelas';

describe('parseCsv', () => {
  it('reads a plain comma-separated roster', () => {
    const records = parseCsv(`${HEADER}\na@x.sch,Ani,XI-A`);
    expect(records).toHaveLength(2);
    expect(records[1].cells).toEqual(['a@x.sch', 'Ani', 'XI-A']);
  });

  it('accepts semicolons, because Excel exports them in many locales', () => {
    const records = parseCsv('email;nama;kelas\na@x.sch;Ani;XI-A');
    expect(records[1].cells).toEqual(['a@x.sch', 'Ani', 'XI-A']);
  });

  it('accepts tabs', () => {
    const records = parseCsv('email\tnama\tkelas\na@x.sch\tAni\tXI-A');
    expect(records[1].cells).toEqual(['a@x.sch', 'Ani', 'XI-A']);
  });

  it('handles quoted fields, escaped quotes, a BOM and CRLF in one go', () => {
    const text = '﻿email,nama\r\n"a@x.sch","Ani ""Pintar""",XI-A\r\n';
    const records = parseCsv(text);
    expect(records[0].cells[0]).toBe('email');
    expect(records[1].cells[1]).toBe('Ani "Pintar"');
  });

  it('keeps a comma inside a quoted field', () => {
    const records = parseCsv('email,nama,kelas\na@x.sch,"Ani, S.Pd",XI-A');
    expect(records[1].cells).toEqual(['a@x.sch', 'Ani, S.Pd', 'XI-A']);
  });

  it('drops blank lines instead of reporting them as malformed', () => {
    const records = parseCsv(`${HEADER}\n\na@x.sch,Ani,XI-A\n\n`);
    expect(records).toHaveLength(2);
  });
});

describe('parseRosterCsv — a bad row never aborts the import', () => {
  it('imports the good rows and reports the bad one', () => {
    const csv = [HEADER, 'a@x.sch,Ani,XI-A', 'not-an-email,Budi,XI-A', 'c@x.sch,Citra,XI-B'].join('\n');
    const { candidates, skipped } = parseRosterCsv(csv);

    expect(candidates.map((c) => c.email)).toEqual(['a@x.sch', 'c@x.sch']);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].email).toBe('not-an-email');
    expect(skipped[0].reason).toMatch(/email/i);
  });

  it('reports a duplicate inside the file and keeps the first occurrence', () => {
    const csv = [HEADER, 'a@x.sch,Ani,XI-A', 'a@x.sch,Ani Lain,XI-B'].join('\n');
    const { candidates, skipped } = parseRosterCsv(csv);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].displayName).toBe('Ani');
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toBe('Email kembar di dalam CSV.');
  });

  it('treats case and surrounding space as the same email when deduplicating', () => {
    const csv = [HEADER, 'a@x.sch,Ani,XI-A', ' A@X.SCH ,Ani Lain,XI-B'].join('\n');
    const { candidates, skipped } = parseRosterCsv(csv);
    expect(candidates).toHaveLength(1);
    expect(skipped).toHaveLength(1);
  });

  it('skips a row with no name, with a message naming the field', () => {
    const { candidates, skipped } = parseRosterCsv([HEADER, 'a@x.sch,,XI-A'].join('\n'));
    expect(candidates).toHaveLength(0);
    expect(skipped[0].reason).toMatch(/nama/i);
  });

  it('trims the class and stores an empty class as null', () => {
    const { candidates } = parseRosterCsv([HEADER, 'a@x.sch,Ani,  XI-A  ', 'b@x.sch,Budi,'].join('\n'));
    expect(candidates[0].className).toBe('XI-A');
    expect(candidates[1].className).toBeNull();
  });

  it('skips the header line quietly', () => {
    const { candidates, skipped } = parseRosterCsv([HEADER, 'a@x.sch,Ani,XI-A'].join('\n'));
    expect(candidates).toHaveLength(1);
    expect(skipped).toHaveLength(0);
  });

  it('only skips a header as the FIRST record — a later "email" line is treated as data', () => {
    // The header check is on the first CELL being "email", so a later row like
    // this is data, and being an invalid address it is reported rather than
    // silently swallowed the way a header is.
    const csv = ['a@x.sch,Ani,XI-A', 'email,Budi,XI-B'].join('\n');
    const { candidates, skipped } = parseRosterCsv(csv);

    expect(candidates.map((c) => c.email)).toEqual(['a@x.sch']);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].line).toBe(2);
    expect(skipped[0].reason).toMatch(/email/i);
  });

  it('reports every bad row rather than stopping at the first', () => {
    const csv = [HEADER, 'bad-1,A,X', 'good@x.sch,B,X', 'bad-2,C,X', 'bad-3,D,X'].join('\n');
    const { candidates, skipped } = parseRosterCsv(csv);
    expect(candidates).toHaveLength(1);
    expect(skipped.map((s) => s.email)).toEqual(['bad-1', 'bad-2', 'bad-3']);
  });

  it('reports the line number as it appears in the file', () => {
    const csv = [HEADER, 'a@x.sch,Ani,XI-A', 'nope,Budi,XI-A'].join('\n');
    const { skipped } = parseRosterCsv(csv);
    expect(skipped[0].line).toBe(3);
  });

  it('returns nothing for empty or whitespace-only input', () => {
    expect(parseRosterCsv('')).toEqual({ candidates: [], skipped: [] });
    expect(parseRosterCsv('\n\n')).toEqual({ candidates: [], skipped: [] });
  });
});
