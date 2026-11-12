import { closesAtFor, releaseAtFor } from '@/lib/time';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Server-side reads for the Today screen (S-3, S-4, M-6, M-7, G-2).
 *
 * Three rules shape this file:
 *  - the callers' session client is used for everything that RLS can express,
 *    so an unreleased question is unfetchable (S-5) and a grade is invisible
 *    until the question has closed (M-7) even if the UI forgets to hide it;
 *  - "is it open / closed" is decided by Postgres (`release_at <= now()`,
 *    `closes_at > now()`), never by the device or this instance's clock;
 *  - the only service-role read in the page path fetches the release instant of
 *    the next scheduled question — a single timestamp, because S-3 has to be
 *    able to say "Soal berikutnya rilis ..." while S-5 keeps the question body
 *    out of every client's reach.
 */

type ServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

const QUESTION_COLUMNS =
  'id, release_date, title, body_latex, image_path, topic, difficulty, release_at, closes_at';

/** Private buckets: every read needs a signed URL. 12 h covers a page left open. */
const SIGNED_URL_TTL_SECONDS = 12 * 60 * 60;

export interface TodayQuestion {
  id: string;
  title: string;
  bodyLatex: string;
  topic: string | null;
  difficulty: number | null;
  releaseAtIso: string;
  closesAtIso: string;
  open: boolean;
  /** Signed URL for the optional diagram, or null when there is none. */
  imageUrl: string | null;
}

export interface OwnSubmission {
  id: string;
  finalAnswer: string;
  stepsText: string;
  photoPaths: string[];
  /** Signed URLs for the member's own photos, same order as `photoPaths`. */
  photoUrls: (string | null)[];
  firstSubmittedAtIso: string;
  updatedAtIso: string;
}

/** M-7: only ever built when the question has closed and an admin graded it. */
export interface OwnGrade {
  isCorrect: boolean;
  basePoints: number;
  speedPoints: number;
  stepsPoints: number;
  totalPoints: number | null;
  feedback: string | null;
  needsRegrade: boolean;
}

export interface PublishedMarkschemeItem {
  position: number;
  descriptionMd: string;
  points: number;
}

/** Q-5 / G-2 / H-2: readable only after `closes_at`. */
export interface PublishedSolution {
  solutionMd: string | null;
  acceptedAnswers: string[];
  markscheme: PublishedMarkschemeItem[] | null;
}

export type TodayData =
  | { status: 'error' }
  | {
      status: 'ok';
      serverNowIso: string;
      question: TodayQuestion | null;
      nextReleaseAtIso: string | null;
      submission: OwnSubmission | null;
      grade: OwnGrade | null;
      solution: PublishedSolution | null;
    };

export async function loadToday(userId: string | null): Promise<TodayData> {
  const supabase = await createServerSupabaseClient();
  const serverNowIso = new Date().toISOString();

  // One wave: the open question, the latest released one (for the closed state),
  // the next scheduled release and the member's own submissions.
  const [openResult, latestResult, nextReleaseAtIso, ownRows] = await Promise.all([
    supabase
      .from('questions')
      .select(QUESTION_COLUMNS)
      .lte('release_at', 'now')
      .gt('closes_at', 'now')
      .order('release_at', { ascending: false })
      .limit(1),
    supabase
      .from('questions')
      .select(QUESTION_COLUMNS)
      .lte('release_at', 'now')
      .order('release_at', { ascending: false })
      .limit(1),
    nextReleaseAt(),
    userId ? ownSubmissions(supabase, userId) : Promise.resolve([]),
  ]);

  if (openResult.error || latestResult.error) {
    console.error('Gagal memuat soal hari ini:', openResult.error?.message ?? latestResult.error?.message);
    return { status: 'error' };
  }

  const openRow = openResult.data?.[0] ?? null;
  const row = openRow ?? latestResult.data?.[0] ?? null;

  if (!row) {
    return {
      status: 'ok',
      serverNowIso,
      question: null,
      nextReleaseAtIso,
      submission: null,
      grade: null,
      solution: null,
    };
  }

  const open = openRow !== null;
  const releaseAtIso = row.release_at ?? releaseAtFor(row.release_date).toISOString();
  const closesAtIso = row.closes_at ?? closesAtFor(releaseAtFor(row.release_date)).toISOString();

  const ownRow = ownRows.find((item) => item.question_id === row.id) ?? null;

  const [imageUrl, solution, grade, photoUrls] = await Promise.all([
    row.image_path ? signOne(supabase, 'question-media', row.image_path) : Promise.resolve(null),
    loadPublishedSolution(supabase, row.id, open),
    // M-7: this query is never even sent before `closes_at`. RLS would return
    // nothing anyway (grades_select_own_closed), so both layers agree.
    !open && ownRow ? loadGrade(supabase, ownRow.id) : Promise.resolve(null),
    ownRow ? signMany(supabase, 'submission-media', ownRow.step_photo_paths) : Promise.resolve([]),
  ]);

  return {
    status: 'ok',
    serverNowIso,
    question: {
      id: row.id,
      title: row.title,
      bodyLatex: row.body_latex,
      topic: row.topic,
      difficulty: row.difficulty,
      releaseAtIso,
      closesAtIso,
      open,
      imageUrl,
    },
    nextReleaseAtIso,
    submission: ownRow
      ? {
          id: ownRow.id,
          finalAnswer: ownRow.final_answer,
          stepsText: ownRow.steps_text ?? '',
          photoPaths: ownRow.step_photo_paths,
          photoUrls,
          firstSubmittedAtIso: ownRow.first_submitted_at,
          updatedAtIso: ownRow.updated_at,
        }
      : null,
    grade,
    solution,
  };
}

/**
 * S-3: the release instant of the next scheduled question. Service role because
 * an unreleased row is deliberately unreadable (S-5) — and only this one column
 * is selected, so no question content can travel with it.
 */
async function nextReleaseAt(): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('questions')
    .select('release_at')
    .gt('release_at', 'now')
    .order('release_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.release_at ?? null;
}

/**
 * `open` is the database's verdict, passed in so the guard is impossible to
 * forget: while the question is live this returns null and the key is never
 * read, whatever the caller does with the result (G-3, M-7).
 */
async function loadPublishedSolution(
  supabase: ServerClient,
  questionId: string,
  open: boolean,
): Promise<PublishedSolution | null> {
  if (open) return null;

  const [solutionResult, keyResult] = await Promise.all([
    supabase
      .from('question_solutions')
      .select('solution_md, publish_markscheme')
      .eq('question_id', questionId)
      .maybeSingle(),
    createSupabaseAdminClient()
      .from('question_keys')
      .select('accepted_answers')
      .eq('question_id', questionId)
      .maybeSingle(),
  ]);

  const solution = solutionResult.data;
  const acceptedAnswers = keyResult.data?.accepted_answers ?? [];
  const markscheme = solution?.publish_markscheme ? await loadMarkscheme(questionId) : null;

  if (!solution && acceptedAnswers.length === 0) return null;

  return {
    solutionMd: solution?.solution_md ?? null,
    acceptedAnswers,
    markscheme,
  };
}

async function loadMarkscheme(questionId: string): Promise<PublishedMarkschemeItem[] | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('question_markschemes')
    .select('position, description_md, points')
    .eq('question_id', questionId)
    .order('position', { ascending: true });

  if (!data || data.length === 0) return null;

  return data.map((item) => ({
    position: item.position,
    descriptionMd: item.description_md,
    points: item.points,
  }));
}

async function ownSubmissions(supabase: ServerClient, userId: string) {
  const { data } = await supabase
    .from('submissions')
    .select(
      'id, question_id, final_answer, steps_text, step_photo_paths, first_submitted_at, updated_at',
    )
    .eq('user_id', userId)
    .order('first_submitted_at', { ascending: false })
    .limit(10);

  return data ?? [];
}

async function loadGrade(supabase: ServerClient, submissionId: string): Promise<OwnGrade | null> {
  const { data } = await supabase
    .from('grades')
    .select(
      'is_correct, base_points, speed_points, steps_points, total_points, private_feedback, needs_regrade',
    )
    .eq('submission_id', submissionId)
    .maybeSingle();

  if (!data) return null;

  return {
    isCorrect: data.is_correct,
    basePoints: Number(data.base_points),
    speedPoints: Number(data.speed_points),
    stepsPoints: Number(data.steps_points),
    totalPoints: data.total_points === null ? null : Number(data.total_points),
    feedback: data.private_feedback,
    needsRegrade: data.needs_regrade,
  };
}

/** Signed URL for one private object. Returns null when the row cannot be read. */
export async function signOne(
  supabase: ServerClient,
  bucket: 'question-media' | 'submission-media',
  path: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error) return null;
  return (data as { signedUrl: string } | null)?.signedUrl ?? null;
}

async function signMany(
  supabase: ServerClient,
  bucket: 'question-media' | 'submission-media',
  paths: string[],
): Promise<(string | null)[]> {
  if (paths.length === 0) return [];

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  const rows = (data ?? []) as { path: string; signedUrl: string | null }[];
  if (error) return paths.map(() => null);

  return paths.map((path) => rows.find((row) => row.path === path)?.signedUrl ?? null);
}
