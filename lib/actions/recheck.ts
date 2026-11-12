'use server';

import { revalidatePath } from 'next/cache';
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from '@/lib/actions/result';
import { requireAdmin } from '@/lib/auth';
import { planRecheck, submissionsToUpdate, type RecheckSummary } from '@/lib/recheck';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Verdict } from '@/lib/answers';
import { z } from 'zod';

/**
 * SPEC section 6, "Wrong key published": fix the key, re-run the auto-check,
 * admin re-confirms affected grades.
 *
 * An auto-verdict is computed once, at submit time, and then frozen — it must be,
 * because the final answer is locked and re-running cannot change what the
 * member wrote. So a corrected key leaves every stored verdict computed against
 * the OLD key. Without this action an admin would repair each of ~40
 * submissions by hand.
 *
 * Admin-only, and it touches only `auto_verdict` (a pre-fill) plus the
 * `needs_regrade` flag — never points. Points move only when an admin re-saves
 * a grade, which is exactly the re-confirmation SPEC asks for.
 */

const questionIdSchema = z.object({ questionId: z.uuid('Soal tidak dikenal.') });

const toVerdict = (value: unknown): Verdict | null =>
  value === 'correct' || value === 'wrong' || value === 'needs_review' ? value : null;

export async function recheckQuestionVerdicts(input: unknown): Promise<ActionResult<RecheckSummary>> {
  await requireAdmin();

  const parsed = questionIdSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const admin = createSupabaseAdminClient();

  // The key has no client SELECT policy at all, so this read must use the
  // service role (docs/SECURITY.md).
  const { data: key, error: keyError } = await admin
    .from('question_keys')
    .select('accepted_answers, tolerance')
    .eq('question_id', parsed.data.questionId)
    .maybeSingle();

  if (keyError) return fromDatabaseError(keyError);
  if (!key) {
    return fail('Soal ini belum punya kunci jawaban, jadi tebakan otomatis tidak bisa dihitung ulang.');
  }

  const { data: rows, error: rowsError } = await admin
    .from('submissions')
    .select('id, final_answer, auto_verdict')
    .eq('question_id', parsed.data.questionId);

  if (rowsError) return fromDatabaseError(rowsError);

  const summary = planRecheck(
    (rows ?? []).map((row) => ({
      id: row.id,
      finalAnswer: row.final_answer,
      currentVerdict: toVerdict(row.auto_verdict),
    })),
    key.accepted_answers,
    key.tolerance,
  );

  const changed = submissionsToUpdate(summary);
  if (changed.length === 0) {
    revalidatePath('/admin/koreksi');
    return ok(summary);
  }

  // One statement per changed submission: the update is tiny and the set is
  // small (one question's worth of members).
  for (const decision of changed) {
    const { error } = await admin
      .from('submissions')
      .update({ auto_verdict: decision.next })
      .eq('id', decision.submissionId);
    if (error) return fromDatabaseError(error);
  }

  // R-3 / R-7: the admin re-confirms. Flag graded submissions whose pre-fill
  // moved so they surface on the dashboard instead of silently disagreeing with
  // the grade already recorded.
  const { error: flagError } = await admin
    .from('grades')
    .update({ needs_regrade: true })
    .in(
      'submission_id',
      changed.map((decision) => decision.submissionId),
    );

  if (flagError) return fromDatabaseError(flagError);

  revalidatePath('/admin/koreksi');
  revalidatePath('/admin');

  return ok(summary);
}
