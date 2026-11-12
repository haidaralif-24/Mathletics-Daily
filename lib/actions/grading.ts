'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { computeGrade } from '@/lib/scoring';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { closesAtFor, releaseAtFor } from '@/lib/time';
import { saveGradeSchema, type SaveGradeInput } from '@/lib/validation';
import type { Verdict } from '@/lib/answers';
import type {
  GradingItem,
  GradingRoster,
  RosterRow,
  RosterStatus,
  SavedGradeInfo,
} from '@/components/grading/types';
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from './result';

/**
 * Grading server actions (R-1..R-7).
 *
 * Reads of the roster go through the caller's RLS-bound client, so admins see
 * exactly what their policies allow. Everything RLS must never expose to a
 * client — the answer key, the mark scheme, other members' photos — is read with
 * the service-role client, and only after `requireAdmin()` has run (hard rules 1,
 * 5 and 8). The points breakdown is always produced by `computeGrade`
 * (lib/scoring.ts) — never reimplemented here (hard rule 4).
 */

/** Signed photo URLs live for 30 minutes; long enough for one grading session. */
const PHOTO_URL_TTL_SECONDS = 30 * 60;

const questionIdSchema = z.uuid('Soal tidak dikenal.');
const submissionIdSchema = z.uuid('Kiriman tidak dikenal.');

/** jsonb array of mark-scheme positions -> number[]. Unknown shapes degrade to []. */
function toTicks(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is number => typeof entry === 'number' && Number.isInteger(entry));
}

function toVerdict(value: string | null): Verdict | null {
  return value === 'correct' || value === 'wrong' || value === 'needs_review' ? value : null;
}

/**
 * R-1: every active member for one question, as Belum kirim / Belum dinilai /
 * Sudah dinilai. Counts are derived on the client (components/grading/utils.ts)
 * so the same code drives the progress label before and after a save.
 */
export async function loadGradingRoster(questionId: string): Promise<ActionResult<GradingRoster>> {
  await requireAdmin();

  const parsed = questionIdSchema.safeParse(questionId);
  if (!parsed.success) return fromZodError(parsed.error);
  const id = parsed.data;

  const supabase = await createServerSupabaseClient();

  const [membersResult, submissionsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, class_name')
      .eq('role', 'member')
      .eq('active', true)
      .order('display_name'),
    supabase
      .from('submissions')
      .select('id, user_id, first_submitted_at, auto_verdict')
      .eq('question_id', id),
  ]);

  if (membersResult.error) return fromDatabaseError(membersResult.error);
  if (submissionsResult.error) return fromDatabaseError(submissionsResult.error);

  const submissions = submissionsResult.data ?? [];
  const submissionIds = submissions.map((submission) => submission.id);

  let grades: {
    submission_id: string;
    total_points: number | null;
    needs_regrade: boolean;
    graded_by: string | null;
  }[] = [];

  if (submissionIds.length > 0) {
    const gradesResult = await supabase
      .from('grades')
      .select('submission_id, total_points, needs_regrade, graded_by')
      .in('submission_id', submissionIds);

    if (gradesResult.error) return fromDatabaseError(gradesResult.error);
    grades = gradesResult.data ?? [];
  }

  // R-5: show who graded last. Admin policies allow reading every profile row.
  const graderIds = [
    ...new Set(grades.map((grade) => grade.graded_by).filter((value): value is string => Boolean(value))),
  ];
  const graderNames = new Map<string, string>();

  if (graderIds.length > 0) {
    const gradersResult = await supabase.from('profiles').select('id, display_name').in('id', graderIds);
    if (gradersResult.error) return fromDatabaseError(gradersResult.error);
    for (const grader of gradersResult.data ?? []) graderNames.set(grader.id, grader.display_name);
  }

  const submissionByMember = new Map(submissions.map((submission) => [submission.user_id, submission]));
  const gradeBySubmission = new Map(grades.map((grade) => [grade.submission_id, grade]));

  const rows: RosterRow[] = (membersResult.data ?? []).map((member) => {
    const submission = submissionByMember.get(member.id) ?? null;
    const grade = submission ? gradeBySubmission.get(submission.id) ?? null : null;

    const status: RosterStatus = !submission ? 'not_submitted' : grade ? 'graded' : 'ungraded';

    return {
      memberId: member.id,
      displayName: member.display_name,
      className: member.class_name,
      status,
      submissionId: submission?.id ?? null,
      firstSubmittedAt: submission?.first_submitted_at ?? null,
      autoVerdict: toVerdict(submission?.auto_verdict ?? null),
      totalPoints: grade?.total_points === null || grade?.total_points === undefined
        ? null
        : Number(grade.total_points),
      needsRegrade: Boolean(grade?.needs_regrade),
      gradedByName: grade?.graded_by ? graderNames.get(grade.graded_by) ?? null : null,
    };
  });

  return ok({ questionId: id, rows });
}

/**
 * R-2: one submission, with the answer key and the mark scheme, for the grading
 * screen. The key is read with the service role and never stored client-side
 * beyond this response (hard rule 8).
 */
export async function loadGradingItem(submissionId: string): Promise<ActionResult<GradingItem>> {
  await requireAdmin();

  const parsed = submissionIdSchema.safeParse(submissionId);
  if (!parsed.success) return fromZodError(parsed.error);
  const id = parsed.data;

  const service = createSupabaseAdminClient();

  const submissionResult = await service
    .from('submissions')
    .select(
      'id, question_id, user_id, final_answer, steps_text, step_photo_paths, auto_verdict, first_submitted_at, updated_at',
    )
    .eq('id', id)
    .maybeSingle();

  if (submissionResult.error) return fromDatabaseError(submissionResult.error);
  const submission = submissionResult.data;
  if (!submission) return fail('Kiriman tidak ditemukan.');

  const [questionResult, keyResult, schemeResult, memberResult, gradeResult] = await Promise.all([
    service
      .from('questions')
      .select('id, title, release_date, release_at, closes_at')
      .eq('id', submission.question_id)
      .maybeSingle(),
    service
      .from('question_keys')
      .select('answer_type, accepted_answers, tolerance')
      .eq('question_id', submission.question_id)
      .maybeSingle(),
    service
      .from('question_markschemes')
      .select('position, description_md, points')
      .eq('question_id', submission.question_id)
      .order('position'),
    service
      .from('profiles')
      .select('display_name, class_name')
      .eq('id', submission.user_id)
      .maybeSingle(),
    service
      .from('grades')
      .select(
        'is_correct, base_points, speed_points, steps_points, total_points, criteria_ticks, private_feedback, graded_by, graded_at, needs_regrade',
      )
      .eq('submission_id', id)
      .maybeSingle(),
  ]);

  if (questionResult.error) return fromDatabaseError(questionResult.error);
  if (keyResult.error) return fromDatabaseError(keyResult.error);
  if (schemeResult.error) return fromDatabaseError(schemeResult.error);
  if (memberResult.error) return fromDatabaseError(memberResult.error);
  if (gradeResult.error) return fromDatabaseError(gradeResult.error);

  const question = questionResult.data;
  if (!question) return fail('Soal tidak ditemukan.');

  // The bucket is private: photos are only reachable through short-lived signed URLs.
  const paths = submission.step_photo_paths ?? [];
  let photos: { path: string; url: string | null }[] = paths.map((path) => ({ path, url: null }));

  if (paths.length > 0) {
    const signed = await service.storage.from('submission-media').createSignedUrls(paths, PHOTO_URL_TTL_SECONDS);
    if (!signed.error && signed.data) {
      const urlByPath = new Map(signed.data.map((entry) => [entry.path, entry.signedUrl]));
      photos = paths.map((path) => ({ path, url: urlByPath.get(path) ?? null }));
    }
  }

  // `release_at`/`closes_at` are generated columns and cannot be null in practice;
  // if PostgREST ever hands back a null we mirror the database rule from
  // `release_date` (lib/time.ts) rather than inventing a value.
  const releaseAt = question.release_at ?? releaseAtFor(question.release_date).toISOString();
  const closesAt = question.closes_at ?? closesAtFor(new Date(releaseAt)).toISOString();
  const gapSeconds = Math.round(
    (new Date(submission.first_submitted_at).getTime() - new Date(releaseAt).getTime()) / 1000,
  );

  const gradeRow = gradeResult.data;
  let gradedByName: string | null = null;
  if (gradeRow?.graded_by) {
    const graderResult = await service
      .from('profiles')
      .select('display_name')
      .eq('id', gradeRow.graded_by)
      .maybeSingle();
    gradedByName = graderResult.data?.display_name ?? null;
  }

  const grade: SavedGradeInfo | null = gradeRow
    ? {
        isCorrect: gradeRow.is_correct,
        basePoints: Number(gradeRow.base_points),
        speedPoints: Number(gradeRow.speed_points),
        stepsPoints: Number(gradeRow.steps_points),
        totalPoints: Number(gradeRow.total_points ?? 0),
        criteriaTicks: toTicks(gradeRow.criteria_ticks),
        privateFeedback: gradeRow.private_feedback,
        gradedByName,
        gradedAt: gradeRow.graded_at,
        needsRegrade: gradeRow.needs_regrade,
      }
    : null;

  return ok({
    submission: {
      id: submission.id,
      questionId: submission.question_id,
      memberId: submission.user_id,
      memberName: memberResult.data?.display_name ?? 'Anggota',
      className: memberResult.data?.class_name ?? null,
      finalAnswer: submission.final_answer,
      autoVerdict: toVerdict(submission.auto_verdict),
      stepsText: submission.steps_text,
      photos,
      firstSubmittedAt: submission.first_submitted_at,
      updatedAt: submission.updated_at,
      gapSeconds,
    },
    question: {
      id: question.id,
      title: question.title,
      releaseAt,
      closesAt,
      answerKey: keyResult.data
        ? {
            answerType: keyResult.data.answer_type,
            acceptedAnswers: keyResult.data.accepted_answers ?? [],
            tolerance: keyResult.data.tolerance === null ? null : Number(keyResult.data.tolerance),
          }
        : null,
      markScheme: (schemeResult.data ?? []).map((item) => ({
        position: item.position,
        descriptionMd: item.description_md,
        points: item.points,
      })),
    },
    grade,
  });
}

/**
 * R-3 / R-5 / R-7: write (or rewrite) a grade. The steps points are the sum of
 * the ticked mark-scheme criteria, and the breakdown comes from `computeGrade`.
 * `total_points` is a generated column and is never written.
 */
export async function saveGrade(input: SaveGradeInput): Promise<ActionResult<SavedGradeInfo>> {
  const admin = await requireAdmin();

  const parsed = saveGradeSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const { submissionId, isCorrect, criteriaTicks, privateFeedback } = parsed.data;
  const service = createSupabaseAdminClient();

  const submissionResult = await service
    .from('submissions')
    .select('id, question_id, first_submitted_at')
    .eq('id', submissionId)
    .maybeSingle();

  if (submissionResult.error) return fromDatabaseError(submissionResult.error);
  const submission = submissionResult.data;
  if (!submission) return fail('Kiriman tidak ditemukan.');

  const [questionResult, schemeResult] = await Promise.all([
    service.from('questions').select('id, release_at').eq('id', submission.question_id).maybeSingle(),
    service
      .from('question_markschemes')
      .select('position, points')
      .eq('question_id', submission.question_id),
  ]);

  if (questionResult.error) return fromDatabaseError(questionResult.error);
  if (schemeResult.error) return fromDatabaseError(schemeResult.error);

  // The release instant comes from the database so the speed share matches the
  // open window exactly (hard rule 3).
  const releaseAt = questionResult.data?.release_at;
  if (!releaseAt) return fail('Soal tidak ditemukan.');

  const markScheme = schemeResult.data ?? [];
  const pointsByPosition = new Map(markScheme.map((item) => [item.position, item.points]));

  // Only positions the mark scheme actually has count; the sum is the steps input.
  const ticks = [...new Set(criteriaTicks)]
    .filter((position) => pointsByPosition.has(position))
    .sort((a, b) => a - b);
  const stepsPoints = ticks.reduce((sum, position) => sum + (pointsByPosition.get(position) ?? 0), 0);

  const breakdown = computeGrade({
    isCorrect,
    stepsPoints,
    firstSubmittedAt: new Date(submission.first_submitted_at),
    releaseAt: new Date(releaseAt),
  });

  const feedback = privateFeedback && privateFeedback.length > 0 ? privateFeedback : null;

  const upsertResult = await service
    .from('grades')
    .upsert(
      {
        submission_id: submissionId,
        is_correct: isCorrect,
        base_points: breakdown.base,
        speed_points: breakdown.speed,
        steps_points: breakdown.steps,
        criteria_ticks: ticks,
        private_feedback: feedback,
        graded_by: admin.id,
        // R-7: rewriting a grade moves graded_at forward. The server clock is the
        // only clock involved; the browser never sends a time.
        graded_at: new Date().toISOString(),
        // R-6: the admin has just looked at the current steps, so the flag is resolved.
        needs_regrade: false,
      },
      { onConflict: 'submission_id' },
    )
    .select(
      'is_correct, base_points, speed_points, steps_points, total_points, criteria_ticks, private_feedback, graded_at, needs_regrade',
    )
    .single();

  if (upsertResult.error) return fromDatabaseError(upsertResult.error);
  const saved = upsertResult.data;
  if (!saved) return fail('Nilai tidak tersimpan. Coba lagi.');

  return ok({
    isCorrect: saved.is_correct,
    basePoints: Number(saved.base_points),
    speedPoints: Number(saved.speed_points),
    stepsPoints: Number(saved.steps_points),
    totalPoints: Number(saved.total_points ?? 0),
    criteriaTicks: toTicks(saved.criteria_ticks),
    privateFeedback: saved.private_feedback,
    gradedByName: admin.displayName,
    gradedAt: saved.graded_at,
    needsRegrade: saved.needs_regrade,
  });
}
