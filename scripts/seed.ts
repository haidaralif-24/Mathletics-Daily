/**
 * Seeds a Supabase project through the ADMIN API.
 * SQL cannot create auth users cleanly, which is why this is a script and not
 * a seed.sql (see supabase/config.toml -> [db.seed] enabled = false).
 *
 * Run against STAGING:  pnpm seed
 *
 * What it creates (docs/TASKS.md, SPEC A-2):
 *  - the admins named in SEED_ADMIN_EMAILS, with SEED_ADMIN_PASSWORD, forced to change it
 *  - 5 dummy members with random one-time temporary passwords
 *  - 3 questions (one closed, one open right now, one upcoming) with keys and mark schemes
 *  - a few submissions and grades, so the grading screen and leaderboard have data
 *
 * NEVER run this against production with dummy data. The guard below refuses a
 * non-local project unless SEED_ALLOW_REMOTE=1 is set on purpose.
 */
import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { computeGrade } from '../lib/scoring';
import { SCORING } from '../lib/config';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error('Isi NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY (lihat .env.example).');
}

const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(url);
if (!isLocal && process.env.SEED_ALLOW_REMOTE !== '1') {
  throw new Error(
    `${url} bukan proyek lokal. Seed ini berisi data palsu. Set SEED_ALLOW_REMOTE=1 kalau kamu yakin ini STAGING.`,
  );
}

const admin: SupabaseClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ------------------------------------------------------------------ time */
// The one place a device clock is acceptable: this is offline fixture data,
// not a user-facing decision. Everything at runtime still uses now() in the DB.
const WIB_OFFSET_HOURS = 7;

function wibDateString(offsetDays = 0): string {
  const shifted = new Date(Date.now() + WIB_OFFSET_HOURS * 3600_000 + offsetDays * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

// `release_at`/`closes_at` are generated columns; the script reads them back
// from the database rather than recomputing the WIB window here (lib/time.ts
// mirrors it for the UI, the database is the source of truth).

/** The WIB calendar date whose [04:00, +24h) window contains now, else today. */
function openWindowDate(): string {
  const wibNow = new Date(Date.now() + WIB_OFFSET_HOURS * 3600_000);
  return wibNow.getUTCHours() >= 4 ? wibDateString(0) : wibDateString(-1);
}

/* ----------------------------------------------------------- passwords */
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function tempPassword(length = 12): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/* --------------------------------------------------------------- users */
interface SeedUser {
  email: string;
  displayName: string;
  className?: string;
}

async function findUserByEmail(email: string) {
  // listUsers is paginated; the club is small, so one page is plenty.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function ensureUser(
  user: SeedUser,
  password: string,
  role: 'member' | 'admin',
): Promise<string> {
  const existing = await findUserByEmail(user.email);

  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password,
      app_metadata: { must_change_password: true, role },
      ban_duration: 'none',
    });
    await admin.from('profiles').update({ role, display_name: user.displayName, class_name: user.className ?? null, active: true }).eq('id', existing.id);
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true, // no mail is ever delivered; the admin hands the password over
    app_metadata: { must_change_password: true, role },
  });
  if (error) throw error;

  const id = data.user.id;
  // The auth.users insert trigger already created the profile row with role = member.
  await admin
    .from('profiles')
    .update({ role, display_name: user.displayName, class_name: user.className ?? null })
    .eq('id', id);

  return id;
}

/* ----------------------------------------------------------- questions */
interface SeedQuestion {
  releaseDate: string;
  title: string;
  bodyLatex: string;
  topic: string;
  difficulty: number;
  acceptedAnswers: string[];
  markScheme: { position: number; descriptionMd: string; points: number }[];
  solutionMd?: string;
}

const QUESTIONS: SeedQuestion[] = [
  {
    releaseDate: wibDateString(-2), // closed
    title: 'Habis dibagi 3, bukan 5',
    bodyLatex:
      'Berapa banyak bilangan bulat positif $n < 100$ yang habis dibagi $3$ tetapi **tidak** habis dibagi $5$?',
    topic: 'Teori Bilangan',
    difficulty: 2,
    acceptedAnswers: ['27'],
    markScheme: [
      { position: 1, descriptionMd: 'Menghitung banyak kelipatan 3 di bawah 100: $\\lfloor 99/3 \\rfloor = 33$.', points: 2 },
      { position: 2, descriptionMd: 'Menyadari kelipatan 15 harus dibuang: $\\lfloor 99/15 \\rfloor = 6$.', points: 2 },
      { position: 3, descriptionMd: 'Mengurangkan dengan benar: $33 - 6 = 27$.', points: 1 },
    ],
    solutionMd:
      'Kelipatan 3 di bawah 100 ada $\\lfloor 99/3 \\rfloor = 33$. Yang juga kelipatan 5 adalah kelipatan 15, ada $\\lfloor 99/15 \\rfloor = 6$. Jadi jawabannya $33 - 6 = 27$.',
  },
  {
    releaseDate: openWindowDate(), // open now
    title: 'Nilai hasil kali',
    bodyLatex: 'Diketahui $x + y = 10$ dan $x^2 + y^2 = 58$. Tentukan nilai $xy$.',
    topic: 'Aljabar',
    difficulty: 2,
    acceptedAnswers: ['21'],
    markScheme: [
      { position: 1, descriptionMd: 'Menulis $(x+y)^2 = x^2 + 2xy + y^2$.', points: 2 },
      { position: 2, descriptionMd: 'Mensubstitusi $100 = 58 + 2xy$.', points: 2 },
      { position: 3, descriptionMd: 'Menyelesaikan $2xy = 42$ sehingga $xy = 21$.', points: 1 },
    ],
  },
  {
    releaseDate: wibDateString(1), // upcoming — do not leak before 04:00 WIB
    title: 'Sisa bagi pangkat besar',
    bodyLatex: 'Tentukan sisa bagi $7^{2026}$ ketika dibagi $100$.',
    topic: 'Teori Bilangan',
    difficulty: 3,
    acceptedAnswers: ['49'],
    markScheme: [
      { position: 1, descriptionMd: 'Menghitung beberapa pangkat: $7^2 = 49$, $7^4 \\equiv 1 \\pmod{100}$.', points: 2 },
      { position: 2, descriptionMd: 'Menyadari periode 4 dan menulis $2026 = 4 \\cdot 506 + 2$.', points: 2 },
      { position: 3, descriptionMd: 'Menyimpulkan $7^{2026} \\equiv 7^2 \\equiv 49 \\pmod{100}$.', points: 1 },
    ],
  },
];

const MEMBERS: SeedUser[] = [
  { email: 'anggota1@mathletics.local', displayName: 'Aisyah Rahma', className: 'XI-A' },
  { email: 'anggota2@mathletics.local', displayName: 'Bagas Pratama', className: 'XI-A' },
  { email: 'anggota3@mathletics.local', displayName: 'Citra Lestari', className: 'XI-B' },
  { email: 'anggota4@mathletics.local', displayName: 'Dimas Nugroho', className: 'XI-B' },
  { email: 'anggota5@mathletics.local', displayName: 'Elsa Maulida', className: 'XI-C' },
];

/* ----------------------------------------------------------------- run */
async function seedQuestions(): Promise<Map<string, { id: string; releaseAt: Date }>> {
  const byDate = new Map<string, { id: string; releaseAt: Date }>();

  for (const q of QUESTIONS) {
    const { data, error } = await admin
      .from('questions')
      .upsert(
        {
          release_date: q.releaseDate,
          title: q.title,
          body_latex: q.bodyLatex,
          topic: q.topic,
          difficulty: q.difficulty,
        },
        { onConflict: 'release_date' },
      )
      .select('id, release_at')
      .single();
    if (error) throw error;

    const questionId = data.id as string;
    byDate.set(q.releaseDate, { id: questionId, releaseAt: new Date(data.release_at as string) });

    const { error: keyError } = await admin.from('question_keys').upsert({
      question_id: questionId,
      answer_type: 'integer',
      accepted_answers: q.acceptedAnswers,
      tolerance: null,
    });
    if (keyError) throw keyError;

    // Replace the mark scheme wholesale so re-running is idempotent.
    await admin.from('question_markschemes').delete().eq('question_id', questionId);
    const { error: msError } = await admin.from('question_markschemes').insert(
      q.markScheme.map((m) => ({
        question_id: questionId,
        position: m.position,
        description_md: m.descriptionMd,
        points: m.points,
      })),
    );
    if (msError) throw msError;

    if (q.solutionMd) {
      const { error: solError } = await admin.from('question_solutions').upsert({
        question_id: questionId,
        solution_md: q.solutionMd,
        publish_markscheme: true,
      });
      if (solError) throw solError;
    }
  }

  return byDate;
}

async function seedSubmissions(questionId: string, releaseAt: Date, memberIds: string[]) {
  const answers = ['27', '27', '28', '27', 'tidak tahu'];
  const steps = [
    'Kelipatan 3 ada 33. Kelipatan 15 ada 6. Jadi 33 - 6 = 27.',
    'Aku bagi 100 dengan 3 dapat 33, lalu kurangi kelipatan 15.',
    '$\\lfloor 99/3 \\rfloor - \\lfloor 99/15 \\rfloor = 33 - 6 = 27$',
    '33 - 6 = 27',
    '',
  ];

  for (let i = 0; i < memberIds.length; i += 1) {
    // Stagger submit times so the speed points and the tie-break differ.
    const firstSubmittedAt = new Date(releaseAt.getTime() + (i + 1) * 90 * 60_000);

    const { data, error } = await admin
      .from('submissions')
      .upsert(
        {
          question_id: questionId,
          user_id: memberIds[i],
          final_answer: answers[i],
          steps_text: steps[i] || null,
          step_photo_paths: [],
          auto_verdict: answers[i] === '27' ? 'correct' : 'wrong',
          first_submitted_at: firstSubmittedAt.toISOString(),
        },
        { onConflict: 'question_id,user_id' },
      )
      .select('id')
      .single();
    if (error) throw error;

    // Grade the first three, leave two ungraded so the grading screen has work to do.
    if (i >= 3) continue;

    const isCorrect = answers[i] === '27';
    const stepsPoints = i === 0 ? 5 : i === 1 ? 3 : 0;
    const { base, speed, steps: sp, total } = computeGrade({
      isCorrect,
      stepsPoints,
      firstSubmittedAt,
      releaseAt,
    });

    const criteria = [1, 2, 3].slice(0, stepsPoints > 0 ? Math.max(1, Math.round(stepsPoints / 2)) : 0);

    const { error: gradeError } = await admin.from('grades').upsert({
      submission_id: data.id,
      is_correct: isCorrect,
      base_points: base,
      speed_points: speed,
      steps_points: sp,
      total_points: total,
      criteria_ticks: criteria,
      private_feedback: isCorrect ? 'Rapi, pertahankan.' : 'Periksa lagi kasus kelipatan 15.',
      graded_at: new Date().toISOString(),
    });
    if (gradeError) throw gradeError;
  }
}

async function main() {
  const adminEmails = (process.env.SEED_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (adminEmails.length === 0 || !adminPassword) {
    throw new Error('SEED_ADMIN_EMAILS dan SEED_ADMIN_PASSWORD wajib diisi (lihat .env.example).');
  }

  const credentials: { email: string; password: string; role: 'admin' | 'member' }[] = [];

  for (const [i, email] of adminEmails.entries()) {
    const id = await ensureUser(
      { email, displayName: `Admin ${i + 1}` },
      adminPassword,
      'admin',
    );
    credentials.push({ email, password: adminPassword, role: 'admin' });
    console.log(`admin  ${email} -> ${id}`);
  }

  const memberIds: string[] = [];
  for (const member of MEMBERS) {
    const password = tempPassword();
    const id = await ensureUser(member, password, 'member');
    memberIds.push(id);
    credentials.push({ email: member.email, password, role: 'member' });
  }

  const questions = await seedQuestions();
  const closed = [...questions.values()].sort((a, b) => a.releaseAt.getTime() - b.releaseAt.getTime())[0];
  if (closed) await seedSubmissions(closed.id, closed.releaseAt, memberIds);

  console.log(`\n${QUESTIONS.length} soal, ${memberIds.length} anggota, ${adminEmails.length} admin.`);
  console.log('\nKata sandi sementara — tampil sekali, catat sekarang:\n');
  for (const c of credentials) console.log(`  ${c.role.padEnd(6)} ${c.email.padEnd(34)} ${c.password}`);
  console.log(`\nPoin maksimum per soal: ${SCORING.base + SCORING.speedMax + SCORING.stepsMax}.`);
  console.log('Semua akun wajib ganti kata sandi saat login pertama.');
}

main().catch((error: unknown) => {
  console.error('\nSeed gagal:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
