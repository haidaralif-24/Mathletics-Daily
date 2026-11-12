'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { GENERIC_ERROR, fail, fromZodError, ok, type ActionResult } from '@/lib/actions/result';
import { requireAdmin } from '@/lib/auth';
import { parseRosterCsv } from '@/lib/csv';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { importMembersSchema, updateMemberSchema } from '@/lib/validation';

/**
 * U-1 / U-2 (SPEC section 4) — admin-only member management.
 *
 * Everything here goes through the service-role client, because members and
 * admins never write `profiles` or auth users from the browser
 * (docs/SECURITY.md). Every action calls `requireAdmin()` FIRST: a member who
 * posts to these endpoints directly is refused before any privileged client is
 * created.
 *
 * Temporary passwords are random, returned exactly once and never stored.
 */

const MEMBER_ROLE = 'member';
const ADMIN_ROLE = 'admin';
/** 100 years: "deactivated" should outlive the club (A-5). */
const BAN_DURATION = '876000h';
const TEMP_PASSWORD_LENGTH = 12;
/** createUser is one HTTP call per row; small batches keep a 40-row roster inside the action timeout. */
const IMPORT_BATCH_SIZE = 4;
const MAX_IMPORT_ROWS = 200;
/** Emails per "already registered" lookup, to keep the query string short. */
const EXISTING_EMAIL_CHUNK = 50;

export interface RosterRowResult {
  /** Record number in the pasted CSV (the header counts as record 1). */
  line: number;
  email: string;
  displayName: string;
  className: string | null;
  status: 'imported' | 'skipped';
  /** Why the row was skipped, in Bahasa Indonesia. */
  reason?: string;
  /** Imported, but something needs an admin follow-up. */
  note?: string;
  /** A-2: shown once in the download, never stored anywhere. */
  temporaryPassword?: string;
}

export interface ImportReport {
  rows: RosterRowResult[];
  importedCount: number;
  skippedCount: number;
}

export interface ResetPasswordResult {
  email: string;
  temporaryPassword: string;
}

/* ------------------------------------------------------------------ helpers */

/**
 * A-2: crypto-random temporary password. The alphabet drops look-alike
 * characters (l/I/1, O/0) because these are read off a printed slip.
 */
function generateTemporaryPassword(length = TEMP_PASSWORD_LENGTH): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  // Largest multiple of the alphabet length below 256, so the modulo has no bias.
  const ceiling = Math.floor(256 / alphabet.length) * alphabet.length;
  const bytes = new Uint8Array(1);
  let password = '';
  while (password.length < length) {
    crypto.getRandomValues(bytes);
    const byte = bytes[0];
    if (byte >= ceiling) continue;
    password += alphabet[byte % alphabet.length];
  }
  return password;
}

/** Maps a Supabase Auth message to Indonesian copy, without ever echoing it. */
function authErrorMessage(message?: string): string {
  const text = (message ?? '').toLowerCase();
  if (text.includes('already') && (text.includes('registered') || text.includes('exists'))) {
    return 'Email sudah terdaftar.';
  }
  if (text.includes('email') && (text.includes('invalid') || text.includes('validate') || text.includes('format'))) {
    return 'Format email tidak valid.';
  }
  if (text.includes('password')) return 'Kata sandi sementara ditolak. Coba lagi.';
  if (text.includes('rate') || text.includes('too many')) {
    return 'Terlalu banyak permintaan ke server. Coba lagi sebentar lagi.';
  }
  return 'Gagal membuat akun.';
}

/**
 * Merges `app_metadata` for one auth user. `must_change_password` also drives
 * proxy.ts (A-3), so both places must stay in step (docs/DATA_MODEL.md).
 * Returns an error message, or null on success.
 */
async function mergeAppMetadata(
  userId: string,
  patch: Record<string, unknown>,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) return 'Anggota tidak ditemukan.';

  const current = (data.user.app_metadata ?? {}) as Record<string, unknown>;
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...current, ...patch },
  });

  return updateError ? GENERIC_ERROR : null;
}

/** Runs `worker` over `items` in fixed-size batches, keeping the input order. */
async function mapInBatches<T, R>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += size) {
    const batch = items.slice(index, index + size);
    results.push(...(await Promise.all(batch.map(worker))));
  }
  return results;
}

const userIdSchema = z.object({ userId: z.uuid('Anggota tidak dikenal.') });
const memberRoleSchema = z.object({
  userId: z.uuid('Anggota tidak dikenal.'),
  role: z.enum([MEMBER_ROLE, ADMIN_ROLE], 'Peran tidak dikenal.'),
});
const memberActiveSchema = z.object({
  userId: z.uuid('Anggota tidak dikenal.'),
  active: z.boolean(),
});

/* ------------------------------------------------------------------ actions */

/**
 * U-1: import a roster CSV (email, nama, kelas). Malformed or duplicate rows are
 * skipped and reported; they never abort the rest of the import (SPEC section 6).
 *
 * The text handling lives in `lib/csv.ts` so it is unit-testable; this action
 * owns only the privileged half — looking accounts up and creating them.
 */
export async function importMembers(input: { csv: string }): Promise<ActionResult<ImportReport>> {
  await requireAdmin();

  const parsed = importMembersSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const { candidates: parsedCandidates, skipped } = parseRosterCsv(parsed.data.csv);
  if (parsedCandidates.length === 0 && skipped.length === 0) {
    return fail('CSV tidak berisi baris data. Format tiap baris: email, nama, kelas.');
  }

  const rows: RosterRowResult[] = skipped.map((row) => ({ ...row, status: 'skipped' as const }));
  const candidates = parsedCandidates.map((row) => ({
    ...row,
    temporaryPassword: generateTemporaryPassword(),
  }));

  if (candidates.length > MAX_IMPORT_ROWS) {
    return fail(`Maksimal ${MAX_IMPORT_ROWS} baris sekali impor. Bagi CSV-nya jadi beberapa bagian.`);
  }

  const admin = createSupabaseAdminClient();

  // A-2 + A-6: an email that already has an account is reported, not overwritten.
  // Looked up in small chunks so the query string stays short.
  const existingEmails = new Set<string>();
  const emails = candidates.map((row) => row.email);
  for (let index = 0; index < emails.length; index += EXISTING_EMAIL_CHUNK) {
    const chunk = emails.slice(index, index + EXISTING_EMAIL_CHUNK);
    const { data, error } = await admin.from('profiles').select('email').in('email', chunk);
    if (error) return fail(GENERIC_ERROR);
    for (const profile of data ?? []) {
      if (profile.email) existingEmails.add(profile.email.trim().toLowerCase());
    }
  }

  const imported = await mapInBatches(candidates, IMPORT_BATCH_SIZE, async (row) => {
    const result: RosterRowResult = {
      line: row.line,
      email: row.email,
      displayName: row.displayName,
      className: row.className,
      status: 'skipped',
    };

    if (existingEmails.has(row.email)) {
      result.reason = 'Email sudah terdaftar.';
      return result;
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: row.email,
      password: row.temporaryPassword,
      email_confirm: true,
      app_metadata: { must_change_password: true, role: MEMBER_ROLE },
      user_metadata: { display_name: row.displayName },
    });

    if (error || !data?.user) {
      result.reason = authErrorMessage(error?.message);
      return result;
    }

    // handle_new_user() creates the profile row; class_name comes from here.
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        display_name: row.displayName,
        class_name: row.className,
        must_change_password: true,
      })
      .eq('id', data.user.id);

    result.status = 'imported';
    result.temporaryPassword = row.temporaryPassword;
    if (profileError) {
      result.note = 'Akun dibuat, tetapi kelas gagal disimpan. Perbaiki lewat Edit.';
    }
    return result;
  });

  rows.push(...imported);
  rows.sort((a, b) => a.line - b.line);

  revalidatePath('/admin/member');

  return ok({
    rows,
    importedCount: rows.filter((row) => row.status === 'imported').length,
    skippedCount: rows.filter((row) => row.status === 'skipped').length,
  });
}

/** U-2 + A-4: new temporary password, shown once, forced change next login. */
export async function resetPassword(input: { userId: string }): Promise<ActionResult<ResetPasswordResult>> {
  await requireAdmin();

  const parsed = userIdSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const { userId } = parsed.data;
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) return fail('Anggota tidak ditemukan.');

  const temporaryPassword = generateTemporaryPassword();
  const current = (data.user.app_metadata ?? {}) as Record<string, unknown>;

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
    app_metadata: { ...current, must_change_password: true },
  });
  if (updateError) return fail(GENERIC_ERROR);

  // A-3 reads the flag from the JWT, but the profile row keeps it too.
  const { error: profileError } = await admin
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', userId);
  if (profileError) return fail(GENERIC_ERROR);

  revalidatePath('/admin/member');

  return ok({ email: data.user.email ?? '', temporaryPassword });
}

/** U-2: edit a member's name and class (decision 18: admins own these fields). */
export async function updateMember(input: {
  userId: string;
  displayName: string;
  className: string | null;
}): Promise<ActionResult<undefined>> {
  await requireAdmin();

  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .update({
      display_name: parsed.data.displayName,
      class_name: parsed.data.className,
    })
    .eq('id', parsed.data.userId)
    .select('id');

  if (error) return fail(GENERIC_ERROR);
  if (!data || data.length === 0) return fail('Anggota tidak ditemukan.');

  revalidatePath('/admin/member');
  return ok(undefined);
}

/** U-2: change a member's role. RLS reads the `profiles` row, not the JWT. */
export async function setMemberRole(input: {
  userId: string;
  role: 'member' | 'admin';
}): Promise<ActionResult<undefined>> {
  const caller = await requireAdmin();

  const parsed = memberRoleSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const { userId, role } = parsed.data;
  if (userId === caller.id && role === MEMBER_ROLE) {
    return fail('Kamu tidak bisa menurunkan peranmu sendiri.');
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select('id');
  if (error) return fail(GENERIC_ERROR);
  if (!data || data.length === 0) return fail('Anggota tidak ditemukan.');

  // Informational only (authorisation reads `profiles`), but keep it honest.
  const metadataError = await mergeAppMetadata(userId, { role });
  if (metadataError) return fail('Peran tersimpan, tetapi data sesi gagal diperbarui. Coba lagi.');

  revalidatePath('/admin/member');
  return ok(undefined);
}

/** U-2: promote a member to admin (the "Jadikan admin" button). */
export async function promoteMember(input: { userId: string }): Promise<ActionResult<undefined>> {
  const parsed = userIdSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  return setMemberRole({ userId: parsed.data.userId, role: ADMIN_ROLE });
}

/**
 * A-5 + U-2: deactivate (`active: false`) bans the auth user, so an old password
 * cannot be used again; reactivation lifts the ban with `'none'`. Because
 * `submit_answer` checks `profiles.active` in the database, writes stop at once.
 */
export async function deactivateMember(input: {
  userId: string;
  active: boolean;
}): Promise<ActionResult<undefined>> {
  const caller = await requireAdmin();

  const parsed = memberActiveSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const { userId, active } = parsed.data;
  if (userId === caller.id) {
    return fail('Kamu tidak bisa menonaktifkan akunmu sendiri.');
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .update({ active })
    .eq('id', userId)
    .select('id');
  if (error) return fail(GENERIC_ERROR);
  if (!data || data.length === 0) return fail('Anggota tidak ditemukan.');

  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? 'none' : BAN_DURATION,
  });
  if (banError) {
    return fail('Status tersimpan, tetapi akses login gagal diperbarui. Coba lagi.');
  }

  revalidatePath('/admin/member');
  return ok(undefined);
}
