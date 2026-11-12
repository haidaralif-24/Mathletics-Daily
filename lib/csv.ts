import { z } from 'zod';
import { emailSchema } from './validation';

/**
 * Roster CSV parsing for U-1.
 *
 * Pure and dependency-free (no Supabase, no `'use server'`) so the behaviour
 * SPEC section 6 and U-1 actually promise can be unit-tested: malformed or
 * duplicate rows are skipped and REPORTED, and never abort the rest of the
 * import. The database half of the import (does the email already exist, create
 * the auth user) stays in `lib/actions/members.ts`; only the text handling and
 * in-file checks live here.
 *
 * This used to be private inside the server action, which made the whole
 * requirement untestable (docs/TASKS.md).
 */

export interface CsvRecord {
  /** 1-based record number as it appears in the file (header included). */
  line: number;
  cells: string[];
}

export interface RosterCandidate {
  line: number;
  email: string;
  displayName: string;
  className: string | null;
}

export interface RosterSkippedRow {
  line: number;
  email: string;
  displayName: string;
  className: string | null;
  reason: string;
}

export interface RosterParseResult {
  candidates: RosterCandidate[];
  skipped: RosterSkippedRow[];
}

/** A first cell matching one of these is treated as a header, not a member. */
export const HEADER_FIRST_CELLS = ['email', 'e-mail', 'surel'];

export const ROSTER_FORMAT_HINT = 'Baris tidak lengkap. Format: email, nama, kelas.';

const rosterRowSchema = z.object({
  email: emailSchema,
  displayName: z.string().trim().min(1, 'Nama wajib diisi.').max(120, 'Nama maksimal 120 karakter.'),
  className: z.string().trim().max(40, 'Kelas maksimal 40 karakter.'),
});

/**
 * Minimal CSV reader: quoted fields, escaped quotes (`""`), CRLF and a BOM.
 * Commas, semicolons and tabs are all accepted as the separator so an
 * Excel-exported roster works as-is.
 */
export function parseCsv(text: string): CsvRecord[] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split('\n', 1)[0] ?? '';
  const delimiters = [',', ';', '\t'];
  const delimiter = delimiters.reduce(
    (best, candidate) =>
      firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best,
    ',',
  );

  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let field = '';
  let inQuotes = false;
  let recordNumber = 0;

  const pushField = () => {
    cells.push(field);
    field = '';
  };
  const pushRecord = () => {
    pushField();
    recordNumber += 1;
    // Blank lines are noise, not malformed rows: they are dropped silently.
    if (cells.some((cell) => cell.trim().length > 0)) {
      records.push({ line: recordNumber, cells });
    }
    cells = [];
  };

  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];

    if (inQuotes) {
      if (char === '"') {
        if (clean[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === delimiter) {
      pushField();
      continue;
    }
    if (char === '\n') {
      pushRecord();
      continue;
    }
    if (char === '\r') continue;
    field += char;
  }

  if (field.length > 0 || cells.length > 0) pushRecord();

  return records;
}

/**
 * Rows that pass validation and are unique within the file, plus every row that
 * was skipped with a human-readable Indonesian reason.
 *
 * A header line is skipped quietly, but only if it is the FIRST record — a
 * member genuinely called "Email" further down must not vanish.
 */
export function parseRosterCsv(text: string): RosterParseResult {
  const records = parseCsv(text);
  const candidates: RosterCandidate[] = [];
  const skipped: RosterSkippedRow[] = [];
  const seenEmails = new Set<string>();
  let firstRecord = true;

  for (const record of records) {
    const email = (record.cells[0] ?? '').trim().toLowerCase();
    const displayName = (record.cells[1] ?? '').trim();
    const classNameRaw = (record.cells[2] ?? '').trim();
    const className = classNameRaw.length > 0 ? classNameRaw : null;

    if (firstRecord && HEADER_FIRST_CELLS.includes(email)) {
      firstRecord = false;
      continue;
    }
    firstRecord = false;

    const row = rosterRowSchema.safeParse({ email, displayName, className: classNameRaw });
    if (!row.success) {
      skipped.push({
        line: record.line,
        email,
        displayName,
        className,
        reason: row.error.issues[0]?.message ?? ROSTER_FORMAT_HINT,
      });
      continue;
    }

    if (seenEmails.has(row.data.email)) {
      skipped.push({
        line: record.line,
        email: row.data.email,
        displayName: row.data.displayName,
        className,
        reason: 'Email kembar di dalam CSV.',
      });
      continue;
    }
    seenEmails.add(row.data.email);

    candidates.push({
      line: record.line,
      email: row.data.email,
      displayName: row.data.displayName,
      className: row.data.className.length > 0 ? row.data.className : null,
    });
  }

  return { candidates, skipped };
}
