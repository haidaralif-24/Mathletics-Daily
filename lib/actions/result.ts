import { z } from 'zod';

/**
 * One result shape for every server action, so all four UI bundles handle
 * success and failure the same way. Actions never throw a raw Postgres or
 * Postgrest message at the user (SPEC section 5, "Copy").
 */

export interface ActionError {
  /** Bahasa Indonesia, safe to render to the user. */
  message: string;
  /** Field-level messages keyed by form field name, for inline errors. */
  fieldErrors?: Record<string, string[]>;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const fail = (message: string, fieldErrors?: Record<string, string[]>): ActionResult<never> => ({
  ok: false,
  error: fieldErrors ? { message, fieldErrors } : { message },
});

/** Turns a Zod failure into field errors plus a short summary line. */
export function fromZodError(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    // Issues without a path are form-level (a `.refine` on the whole object).
    const key = issue.path.length > 0 ? String(issue.path[0]) : '_form';
    (fieldErrors[key] ??= []).push(issue.message);
  }

  const first = fieldErrors._form?.[0] ?? Object.values(fieldErrors)[0]?.[0];
  return fail(first ?? 'Ada isian yang belum benar. Periksa kembali.', fieldErrors);
}

/**
 * Maps a database error to Indonesian copy. `submit_answer` raises messages
 * that are already user-facing, so those pass through; anything else becomes a
 * generic line and the detail is left for the server logs.
 *
 * Keep this list in step with the `raise exception` strings in
 * `supabase/migrations/0001_init.sql` — a mismatch silently degrades a specific,
 * useful message into "Terjadi kesalahan", which is what the spec reviewer
 * caught for the inactive-account and photo-path cases.
 */
// Exact `raise exception` strings from supabase/migrations/0001_init.sql,
// matched with `includes` so a longer message still resolves. Keep in step with
// that file — a mismatch silently degrades a specific, useful message into
// "Terjadi kesalahan", which is what the spec reviewer caught.
const KNOWN_DB_MESSAGES = [
  'Soal ini sudah ditutup',
  'Soal ini belum dibuka',
  'Jawaban akhir tidak bisa diubah setelah dikirim',
  'Admin tidak mengirim jawaban',
  'Akun Anda tidak aktif',
  'Anda harus masuk untuk mengirim jawaban',
  'Profil tidak ditemukan',
  'Soal tidak ditemukan',
  'Lokasi foto tidak valid',
  'Jawaban akhir wajib diisi',
  'Jawaban akhir maksimal 500 karakter',
  'Langkah pengerjaan wajib diisi',
  'Maksimal 5 foto langkah pengerjaan',
  'Periode tidak dikenal',
];

export function fromDatabaseError(error: { message?: string; code?: string } | null): ActionResult<never> {
  const message = error?.message ?? '';
  const match = KNOWN_DB_MESSAGES.find((text) => message.includes(text));
  if (match) return fail(match);

  return fail('Terjadi kesalahan. Coba lagi sebentar lagi.');
}

export const GENERIC_ERROR = 'Terjadi kesalahan. Coba lagi sebentar lagi.';
