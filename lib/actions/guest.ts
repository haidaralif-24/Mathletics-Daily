'use server';

import { checkAnswer, type Verdict } from '@/lib/answers';
import { fail, fromZodError, ok, type ActionResult } from '@/lib/actions/result';
import { checkRateLimit } from '@/lib/ratelimit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { guestAnswerSchema } from '@/lib/validation';

/**
 * G-1..G-3: a guest may try a released question. Nothing is stored, no account
 * exists, and the answer key is read only on the server.
 *
 * The result is a discriminated union: while the question is open the payload
 * carries *no* verdict and *no* key — not even an empty string — so there is
 * nothing to inspect in the browser before `closes_at` (hard rule 8).
 */

export type GuestCheck =
  | { state: 'open' }
  | {
      state: 'closed';
      verdict: Verdict;
      /** The accepted answers. Only ever returned once the question has closed. */
      acceptedAnswers: string[];
    };

export async function checkGuestAnswer(input: unknown): Promise<ActionResult<GuestCheck>> {
  const parsed = guestAnswerSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const { questionId, answer } = parsed.data;

  // Hook for a real limiter later (docs/SECURITY.md); nothing stored either way.
  const limit = await checkRateLimit(`guest-check:${questionId}`);
  if (!limit.ok) return fail('Terlalu banyak percobaan. Coba lagi sebentar lagi.');

  const supabase = await createServerSupabaseClient();

  // Is the question closed? Postgres evaluates `now()`, so the decision depends
  // on neither the phone's clock (hard rule 3) nor this instance's clock.
  const [visible, closed] = await Promise.all([
    supabase.from('questions').select('id').eq('id', questionId).maybeSingle(),
    supabase
      .from('questions')
      .select('id')
      .eq('id', questionId)
      .lte('closes_at', 'now')
      .maybeSingle(),
  ]);

  // RLS already hides an unreleased question from anonymous callers (S-5).
  if (!visible.data) return fail('Soal tidak ditemukan.');
  if (!closed.data) return ok({ state: 'open' });

  // Past `closes_at` only. `question_keys` has no client read policy at all, so
  // this is the one place the key is touched, with the service role.
  const { data: key } = await createSupabaseAdminClient()
    .from('question_keys')
    .select('accepted_answers, tolerance')
    .eq('question_id', questionId)
    .maybeSingle();

  return ok({
    state: 'closed',
    verdict: key
      ? checkAnswer(answer, key.accepted_answers, key.tolerance ?? undefined)
      : 'needs_review',
    acceptedAnswers: key?.accepted_answers ?? [],
  });
}
