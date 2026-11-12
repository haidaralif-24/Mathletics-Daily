'use server';

import { revalidatePath } from 'next/cache';
import { checkAnswer, type Verdict } from '@/lib/answers';
import { requireUser } from '@/lib/auth';
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from '@/lib/actions/result';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { submitAnswerSchema } from '@/lib/validation';

/**
 * M-1..M-5: the only way a member writes a submission. Members have no write
 * policy on any table, so the row is written by `submit_answer` (security
 * definer).
 *
 * That function is granted to `service_role` ONLY — a member cannot call it
 * from the browser (docs/DECISIONS.md 30). This matters because the verdict it
 * stores pre-fills the grader's Correct/Wrong toggle (R-2) and the grader
 * accepts that with one keystroke (R-4), so a verdict a member could set would
 * be a route to unearned points.
 *
 * `p_user_id` is therefore taken from the verified session via `requireUser()`
 * and never from the request body. The function still enforces the window, the
 * account state, the final-answer lock and the photo-path prefix in SQL.
 *
 * The answer key is read here, on the server, with the service role. Only the
 * resulting verdict is passed on; the key never reaches the browser (G-3, M-7).
 */

export interface SubmitAnswerData {
  submissionId: string;
  /** M-6: the moment the server stamped the first submit. */
  firstSubmittedAtIso: string;
  /** True when this call created the row; false when it only replaced the steps. */
  firstSubmit: boolean;
}

export async function submitAnswer(input: unknown): Promise<ActionResult<SubmitAnswerData>> {
  // Guests are sent to /login by requireUser(); the database would reject the
  // write anyway, but the redirect keeps the flow honest.
  const user = await requireUser();

  const parsed = submitAnswerSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const { questionId, finalAnswer, steps } = parsed.data;
  const stepsText = steps.stepsText ?? '';
  const photoPaths = steps.photoPaths;

  const supabase = await createServerSupabaseClient();

  // Is this the first submit? The copy and the locked final answer depend on it
  // (M-3), and the client needs an honest answer for its "Jawaban terkirim" UI.
  const { data: existing } = await supabase
    .from('submissions')
    .select('id')
    .eq('question_id', questionId)
    .eq('user_id', user.id)
    .maybeSingle();

  const verdict = await autoVerdict(questionId, finalAnswer);

  // Service role: `submit_answer` is not executable by `authenticated`
  // (docs/DECISIONS.md 30). `user.id` is the verified session subject, so a
  // caller cannot write a submission into someone else's row.
  const admin = createSupabaseAdminClient();
  const { data: submissionId, error } = await admin.rpc('submit_answer', {
    p_user_id: user.id,
    p_question_id: questionId,
    p_final_answer: finalAnswer,
    p_steps_text: stepsText,
    p_photo_paths: photoPaths,
    p_auto_verdict: verdict,
  });

  if (error) {
    // The database decides the window, the lock and the account state
    // (M-3, M-4, A-5); its messages are user-facing Indonesian already.
    console.error('submit_answer gagal:', error.code, error.message);
    return fromDatabaseError(error);
  }

  if (!submissionId) return fail('Jawaban belum tersimpan. Coba lagi ya.');

  const { data: saved } = await supabase
    .from('submissions')
    .select('first_submitted_at')
    .eq('id', submissionId)
    .maybeSingle();

  // The status chip and the locked field are server-rendered (M-6).
  revalidatePath('/');

  return ok({
    submissionId,
    firstSubmittedAtIso: saved?.first_submitted_at ?? new Date().toISOString(),
    firstSubmit: !existing,
  });
}

/**
 * Reads the key with the service role and runs the single answer-matching
 * implementation in `lib/answers.ts`. A question without a key row is
 * `needs_review`, never `wrong` (SPEC edge cases).
 */
async function autoVerdict(questionId: string, finalAnswer: string): Promise<Verdict> {
  const admin = createSupabaseAdminClient();
  const { data: key } = await admin
    .from('question_keys')
    .select('accepted_answers, tolerance')
    .eq('question_id', questionId)
    .maybeSingle();

  if (!key) return 'needs_review';

  return checkAnswer(finalAnswer, key.accepted_answers, key.tolerance ?? undefined);
}
