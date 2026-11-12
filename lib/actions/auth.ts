'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { GENERIC_ERROR, fail, fromZodError, ok, type ActionResult } from '@/lib/actions/result';
import { checkRateLimit } from '@/lib/ratelimit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { changePasswordSchema, signInSchema } from '@/lib/validation';

/**
 * Session actions: sign in, sign out and change password.
 * Every failure message here is Bahasa Indonesia and safe to show as-is
 * (SPEC section 5, "Copy"). Never a raw Supabase message.
 */

/** A-6: one generic message for every credential failure. */
const LOGIN_ERROR = 'Email atau kata sandi salah';
const RATE_LIMIT_ERROR = 'Terlalu banyak percobaan masuk. Coba lagi sebentar lagi.';
const SESSION_ERROR = 'Sesi kamu berakhir. Masuk lagi, ya.';
const INACTIVE_ERROR = 'Akun ini dinonaktifkan. Hubungi admin klub.';

export interface SignInPayload {
  email: string;
  password: string;
  /** `?next=` set by proxy.ts. Only same-site paths are honoured. */
  next?: string;
}

export interface ChangePasswordPayload {
  password: string;
  confirmPassword: string;
}

/**
 * A `?next=` value may only point back into this app: `//evil.example` and
 * backslashes are open-redirect tricks, so they fall back to `/`.
 */
function safeNextPath(next: unknown): string {
  if (typeof next !== 'string' || next.length === 0) return '/';
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  if (next.includes('\\')) return '/';
  return next;
}

/**
 * A-1 + decision 16: login runs on the server, so Supabase Auth's built-in
 * rate limit applies to every attempt no matter what the client does. The
 * extra `checkRateLimit` call is the hook for a real limiter later
 * (docs/SECURITY.md).
 */
export async function signIn(payload: SignInPayload): Promise<ActionResult<undefined>> {
  const parsed = signInSchema.safeParse({ email: payload.email, password: payload.password });
  if (!parsed.success) return fromZodError(parsed.error);

  const { email, password } = parsed.data;

  const limit = await checkRateLimit(`login:${email}`);
  if (!limit.ok) return fail(RATE_LIMIT_ERROR);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Never distinguish "unknown email" from "wrong password" (A-6).
    return fail(LOGIN_ERROR);
  }

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  // A-5: a deactivated member never keeps a session, even if the auth ban was lifted.
  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('active')
      .eq('id', userId)
      .maybeSingle();

    if (profile && profile.active === false) {
      await supabase.auth.signOut();
      return fail(INACTIVE_ERROR);
    }
  }

  // A-3: the forced change wins over `?next=`, so nobody reaches a screen first.
  if (data?.claims?.app_metadata?.must_change_password === true) {
    redirect('/ganti-sandi');
  }

  redirect(safeNextPath(payload.next));
}

export async function signOut(): Promise<ActionResult<undefined>> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect('/');
}

/** Reads the caller's session, or returns null. Shared by the actions below. */
async function currentUserId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

/**
 * Merges `app_metadata` for one auth user. The flag lives in `app_metadata` so
 * proxy.ts can read it from the JWT without a query (decision 17), and GoTrue
 * merges metadata — reading first and sending the union keeps `provider` and
 * friends intact whatever the server version does.
 *
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

/**
 * A-3 + A-7: a member changes their own password. Minimum 8 characters
 * (`passwordSchema`). The `must_change_password` flag is kept in step in both
 * places, and the session is refreshed so the JWT drops the flag — otherwise
 * proxy.ts would bounce the member straight back to /ganti-sandi.
 */
export async function changePassword(
  payload: ChangePasswordPayload,
): Promise<ActionResult<{ relogin: boolean }>> {
  const parsed = changePasswordSchema.safeParse(payload);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createServerSupabaseClient();
  const userId = await currentUserId();
  if (!userId) return fail(SESSION_ERROR);

  const { error: passwordError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (passwordError) {
    const message = passwordError.message.toLowerCase();
    if (message.includes('different') || message.includes('same as')) {
      return fail('Kata sandi baru harus berbeda dari kata sandi sekarang.');
    }
    if (message.includes('weak') || message.includes('length') || message.includes('characters')) {
      return fail('Kata sandi minimal 8 karakter.');
    }
    return fail(GENERIC_ERROR);
  }

  // Members cannot write `profiles` (docs/SECURITY.md), so this needs the service role.
  const admin = createSupabaseAdminClient();
  const { error: profileError } = await admin
    .from('profiles')
    .update({ must_change_password: false })
    .eq('id', userId);
  if (profileError) return fail(GENERIC_ERROR);

  const metadataError = await mergeAppMetadata(userId, { must_change_password: false });
  if (metadataError) return fail(GENERIC_ERROR);

  const { error: refreshError } = await supabase.auth.refreshSession();

  // Verify the loop really terminates: the new JWT must no longer carry the flag.
  const { data: claimsAfter } = await supabase.auth.getClaims();
  const stillFlagged = claimsAfter?.claims?.app_metadata?.must_change_password === true;

  if (refreshError || stillFlagged) {
    // Escape hatch: sign out rather than leave the member stuck bouncing between
    // /ganti-sandi and proxy.ts. The new password already works, so signing in
    // again issues a clean JWT.
    await supabase.auth.signOut();
    return ok({ relogin: true });
  }

  revalidatePath('/', 'layout');
  return ok({ relogin: false });
}
