import { closesAtFor, releaseAtFor } from '@/lib/time';
import { requireAdmin } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  addDays,
  formatWibDate,
  wibDateString,
  type AnswerType,
  type MarkSchemeRecord,
  type QuestionEditorRecord,
  type QuestionKeyRecord,
  type QuestionListItem,
  type QuestionOverview,
} from './payload';

/**
 * Pembacaan data admin untuk `/admin` dan `/admin/soal`.
 *
 * `question_keys` dan `question_markschemes` tidak punya policy baca untuk
 * klien sama sekali (docs/DATA_MODEL.md), jadi pembacaannya memakai klien
 * service role — selalu setelah `requireAdmin()`. Semua fungsi di berkas ini
 * server-only dan tidak boleh diimpor komponen klien.
 */

/** Hanya ini jumlah soal terbaru yang dihitung jumlah kirimannya (1 query per soal). */
export const QUESTION_LIST_LIMIT = 30;

function must<T>(result: { data: T | null; error: { message?: string } | null }): T {
  if (result.error) throw new Error('Gagal memuat data soal dari database.');
  return result.data as T;
}

/** Kolom generated bisa null di tipe hasil generate; turunkan lagi dari `release_date` (S-1). */
function windowOf(row: { release_date: string; release_at: string | null; closes_at: string | null }): {
  releaseAt: string;
  closesAt: string;
} {
  const derivedRelease = releaseAtFor(row.release_date);
  return {
    releaseAt: row.release_at ?? derivedRelease.toISOString(),
    closesAt: row.closes_at ?? closesAtFor(derivedRelease).toISOString(),
  };
}

interface QuestionRow {
  id: string;
  release_date: string;
  release_at: string | null;
  closes_at: string | null;
  title: string;
  topic: string | null;
  difficulty: number | null;
}

function toOverview(
  row: QuestionRow,
  keys: ReadonlySet<string>,
  schemes: ReadonlySet<string>,
): QuestionOverview {
  return {
    id: row.id,
    releaseDate: row.release_date,
    title: row.title,
    topic: row.topic,
    difficulty: row.difficulty,
    hasKey: keys.has(row.id),
    hasMarkScheme: schemes.has(row.id),
    ...windowOf(row),
  };
}

/** Kelengkapan kunci dan mark scheme untuk sekumpulan soal. */
async function completenessFor(
  db: ReturnType<typeof createSupabaseAdminClient>,
): Promise<{ keys: Set<string>; schemes: Set<string> }> {
  const [keysResult, schemesResult] = await Promise.all([
    db.from('question_keys').select('question_id'),
    db.from('question_markschemes').select('question_id'),
  ]);

  const keys = new Set(must(keysResult).map((row) => row.question_id));
  const schemes = new Set(must(schemesResult).map((row) => row.question_id));
  return { keys, schemes };
}

/** Soal terbaru untuk dasbor dan daftar soal (paling baru di atas, Q-2). */
export async function listQuestions(
  limit = QUESTION_LIST_LIMIT,
): Promise<{ questions: QuestionOverview[]; total: number }> {
  await requireAdmin();
  const db = createSupabaseAdminClient();

  const [questionsResult, totalResult, completeness] = await Promise.all([
    db
      .from('questions')
      .select('id, release_date, release_at, closes_at, title, topic, difficulty')
      .order('release_date', { ascending: false })
      .limit(limit),
    db.from('questions').select('id', { count: 'exact', head: true }),
    completenessFor(db),
  ]);

  const rows = must(questionsResult) as QuestionRow[];
  return {
    questions: rows.map((row) => toOverview(row, completeness.keys, completeness.schemes)),
    total: totalResult.count ?? rows.length,
  };
}

/** Jumlah kiriman per soal (Q-2: kiriman jadi alasan soal tidak bisa dihapus). */
export async function countSubmissionsByQuestion(
  questionIds: readonly string[],
): Promise<Record<string, number>> {
  if (questionIds.length === 0) return {};
  await requireAdmin();
  const db = createSupabaseAdminClient();

  const entries = await Promise.all(
    questionIds.map(async (questionId) => {
      const { count, error } = await db
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('question_id', questionId);
      if (error) throw new Error('Gagal menghitung kiriman anggota.');
      return [questionId, count ?? 0] as const;
    }),
  );

  return Object.fromEntries(entries);
}

/** Daftar soal lengkap dengan jumlah kiriman, untuk `/admin/soal`. */
export async function listQuestionItems(
  limit = QUESTION_LIST_LIMIT,
): Promise<{ questions: QuestionListItem[]; total: number }> {
  const { questions, total } = await listQuestions(limit);
  const counts = await countSubmissionsByQuestion(questions.map((question) => question.id));

  return {
    questions: questions.map((question) => ({
      ...question,
      submissionCount: counts[question.id] ?? 0,
    })),
    total,
  };
}

/** Satu soal untuk editor, termasuk kunci, mark scheme, dan URL gambar. */
export async function getQuestionForEdit(id: string): Promise<QuestionEditorRecord | null> {
  await requireAdmin();
  const db = createSupabaseAdminClient();

  const { data: question, error } = await db
    .from('questions')
    .select('id, release_date, release_at, closes_at, title, topic, difficulty, body_latex, image_path')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error('Gagal memuat soal.');
  if (!question) return null;

  const [keyResult, schemeResult, submissionsResult] = await Promise.all([
    db
      .from('question_keys')
      .select('answer_type, accepted_answers, tolerance')
      .eq('question_id', id)
      .maybeSingle(),
    db
      .from('question_markschemes')
      .select('position, description_md, points')
      .eq('question_id', id)
      .order('position', { ascending: true }),
    db.from('submissions').select('id', { count: 'exact', head: true }).eq('question_id', id),
  ]);

  const key = must(keyResult);
  const answerKey: QuestionKeyRecord | null = key
    ? {
        answerType: key.answer_type as AnswerType,
        acceptedAnswers: key.accepted_answers ?? [],
        tolerance: key.tolerance,
      }
    : null;

  const markScheme: MarkSchemeRecord[] = must(schemeResult).map((row) => ({
    position: row.position,
    descriptionMd: row.description_md,
    points: row.points,
  }));

  let imageUrl: string | null = null;
  if (question.image_path) {
    const { data } = await db.storage.from('question-media').createSignedUrl(question.image_path, 60 * 30);
    imageUrl = data?.signedUrl ?? null;
  }

  return {
    id: question.id,
    releaseDate: question.release_date,
    title: question.title,
    topic: question.topic,
    difficulty: question.difficulty,
    bodyLatex: question.body_latex,
    imagePath: question.image_path,
    imageUrl,
    answerKey,
    markScheme,
    submissionCount: submissionsResult.count ?? 0,
    ...windowOf(question),
  };
}

/* ------------------------------------------------------------- peringatan */

/**
 * Tanggal WIB pertama (mulai hari ini) yang belum punya soal. Dipakai sebagai
 * nilai awal editor supaya admin tidak langsung bertabrakan dengan aturan
 * unik `release_date` (Q-2).
 *
 * `now` opsional dan hanya dibaca setelah `requireAdmin()`, karena `new Date()`
 * di dalam jalur render sebelum akses dinamis akan ditolak saat prerender
 * dengan `cacheComponents` aktif.
 */
export async function findNextFreeReleaseDate(now?: Date): Promise<string> {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  const current = now ?? new Date();

  const today = wibDateString(current);
  const { data, error } = await db
    .from('questions')
    .select('release_date')
    .gte('release_date', today)
    .order('release_date', { ascending: true })
    .limit(60);

  if (error) throw new Error('Gagal memeriksa jadwal soal.');

  const taken = new Set((data ?? []).map((row) => row.release_date));
  let candidate = today;
  for (let step = 0; step < 30; step += 1) {
    if (!taken.has(candidate)) return candidate;
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

function gapCopy(label: string, releaseDate: string): string {
  return `Belum ada soal untuk ${label} (${formatWibDate(releaseDate)}).`;
}

/**
 * Q-2: peringatan celah jadwal. Hari ini dan besok adalah minimum yang diminta
 * ("at least tomorrow"); teksnya memakai kalimat yang sama dengan draf brief.
 *
 * `now` hanya dibaca setelah `requireAdmin()` (lihat catatan di
 * `findNextFreeReleaseDate`): default parameter `new Date()` akan dievaluasi
 * sebelum akses dinamis dan ditolak saat prerender.
 */
export async function loadGapWarnings(now?: Date): Promise<string[]> {
  await requireAdmin();
  const db = createSupabaseAdminClient();

  const today = wibDateString(now ?? new Date());
  const tomorrow = addDays(today, 1);

  const [todayResult, tomorrowResult] = await Promise.all([
    db.from('questions').select('id', { count: 'exact', head: true }).eq('release_date', today),
    db.from('questions').select('id', { count: 'exact', head: true }).eq('release_date', tomorrow),
  ]);

  if (todayResult.error || tomorrowResult.error) throw new Error('Gagal memeriksa jadwal soal.');

  const warnings: string[] = [];
  if ((todayResult.count ?? 0) === 0) warnings.push(gapCopy('hari ini', today));
  if ((tomorrowResult.count ?? 0) === 0) warnings.push(gapCopy('besok', tomorrow));
  return warnings;
}

/** Tanggal kalender WIB dari `payload.ts`; jangan dihitung ulang di sini. */

/** Soal terjadwal berikutnya (belum rilis); null kalau tidak ada jadwal lagi. */
export interface NextQuestionSummary {
  id: string;
  title: string;
  releaseDate: string;
  releaseAt: string;
}

export interface AdminDashboardData {
  totalQuestions: number;
  submissionsTotal: number;
  gradedTotal: number;
  /** Kiriman yang belum dinilai (R-1: "Belum dinilai"). */
  pendingGrading: number;
  /** R-6: sudah dinilai lalu langkahnya diubah anggota. */
  needsRegrade: number;
  gapWarnings: string[];
  nextQuestion: NextQuestionSummary | null;
  recentQuestions: QuestionOverview[];
}

/** Data untuk `/admin` (Q-2 + jumlah pekerjaan yang menunggu). */
export async function loadAdminDashboard(now?: Date): Promise<AdminDashboardData> {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  const current = now ?? new Date();

  const [
    questionsResult,
    totalResult,
    submissionsResult,
    gradesResult,
    regradeResult,
    nextResult,
    gapWarnings,
  ] = await Promise.all([
    db
      .from('questions')
      .select('id, release_date, release_at, closes_at, title, topic, difficulty')
      .order('release_date', { ascending: false })
      .limit(5),
    db.from('questions').select('id', { count: 'exact', head: true }),
    db.from('submissions').select('id', { count: 'exact', head: true }),
    db.from('grades').select('submission_id', { count: 'exact', head: true }),
    db.from('grades').select('submission_id', { count: 'exact', head: true }).eq('needs_regrade', true),
    db
      .from('questions')
      .select('id, title, release_date, release_at')
      .gte('release_at', current.toISOString())
      .order('release_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    loadGapWarnings(current),
  ]);

  const completeness = await completenessFor(db);
  const recentQuestions = (must(questionsResult) as QuestionRow[]).map((row) =>
    toOverview(row, completeness.keys, completeness.schemes),
  );

  const submissionsTotal = submissionsResult.count ?? 0;
  const gradedTotal = gradesResult.count ?? 0;
  const next = must(nextResult);

  return {
    totalQuestions: totalResult.count ?? recentQuestions.length,
    submissionsTotal,
    gradedTotal,
    pendingGrading: Math.max(submissionsTotal - gradedTotal, 0),
    needsRegrade: regradeResult.count ?? 0,
    gapWarnings,
    nextQuestion: next
      ? {
          id: next.id,
          title: next.title,
          releaseDate: next.release_date,
          releaseAt: next.release_at ?? releaseAtFor(next.release_date).toISOString(),
        }
      : null,
    recentQuestions,
  };
}
