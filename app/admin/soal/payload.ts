import { z } from 'zod';
import { closesAtFor, formatWib, releaseAtFor } from '@/lib/time';
import {
  ANSWER_TYPES,
  answerKeySchema,
  markSchemeItemSchema,
  questionSchema,
} from '@/lib/validation';

/**
 * Bentuk data + konversi murni yang dipakai bersama oleh halaman admin, form
 * editor, dan server action (`lib/actions/questions.ts`).
 *
 * Berkas ini TIDAK boleh mengimpor apa pun yang khusus server, karena dipakai
 * di komponen klien juga. Skema Zod-nya sama persis dengan yang dipakai server,
 * jadi form dan action tidak bisa berbeda aturan (AGENTS.md "Conventions").
 */

export type AnswerType = (typeof ANSWER_TYPES)[number];

export const ANSWER_TYPE_LABELS: Record<AnswerType, string> = {
  integer: 'Bilangan bulat',
  fraction: 'Pecahan',
  decimal: 'Desimal (pakai toleransi)',
  text: 'Teks bebas',
};

/** Bagian soal yang belum lengkap (Q-3). */
export type MissingSection = 'key' | 'markScheme';

/* ------------------------------------------------------------- baris data */

export interface QuestionKeyRecord {
  answerType: AnswerType;
  acceptedAnswers: string[];
  tolerance: number | null;
}

export interface MarkSchemeRecord {
  /** Posisi kriteria di database; dipakai `criteria_ticks` saat penilaian. */
  position: number;
  descriptionMd: string;
  points: number;
}

/** Ringkasan satu soal untuk daftar dan dasbor admin. */
export interface QuestionOverview {
  id: string;
  releaseDate: string;
  /** ISO dari kolom generated `release_at` (S-1). */
  releaseAt: string;
  /** ISO dari kolom generated `closes_at`. */
  closesAt: string;
  title: string;
  topic: string | null;
  difficulty: number | null;
  hasKey: boolean;
  hasMarkScheme: boolean;
}

/** Baris di `/admin/soal`: ringkasan + jumlah kiriman anggota. */
export interface QuestionListItem extends QuestionOverview {
  submissionCount: number;
}

/** Semua yang dibutuhkan editor soal (Q-1..Q-4). */
export interface QuestionEditorRecord {
  id: string;
  releaseDate: string;
  releaseAt: string;
  closesAt: string;
  title: string;
  topic: string | null;
  difficulty: number | null;
  bodyLatex: string;
  /** Path objek di bucket `question-media`, bukan URL (docs/DATA_MODEL.md). */
  imagePath: string | null;
  /** URL bertanda tangan untuk pratinjau; hanya dibuat di server. */
  imageUrl: string | null;
  answerKey: QuestionKeyRecord | null;
  markScheme: MarkSchemeRecord[];
  submissionCount: number;
}

/* --------------------------------------------------------------- validasi */

/**
 * Payload `saveQuestion`. Bagian soal memakai `questionSchema`, kunci memakai
 * `answerKeySchema`, dan setiap baris mark scheme memakai
 * `markSchemeItemSchema` dari `lib/validation.ts` — tidak ada aturan kembar.
 *
 * Mark scheme boleh kosong (draf, Q-3). Kalau berisi, aturan penuh
 * (`markSchemeSchema`: posisi unik, total <= SCORING.stepsMax) berlaku dan
 * diperiksa di action dengan skema yang sama.
 */
export const saveQuestionInputSchema = z.object({
  id: z.uuid('Soal tidak dikenal.').nullable(),
  question: questionSchema,
  answerKey: answerKeySchema.nullable(),
  markScheme: z
    .array(markSchemeItemSchema)
    .max(20, 'Kriteria mark scheme maksimal 20 baris.'),
});

export type SaveQuestionInput = z.input<typeof saveQuestionInputSchema>;

export const MAX_MARK_SCHEME_ROWS = 20;

/** Batas bucket `question-media` (supabase/migrations/0001_init.sql). */
export const QUESTION_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const QUESTION_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Poin awal satu kriteria baru; tetap di bawah batas `SCORING.stepsMax`. */
const SCORING_STEP_DEFAULT = 1;

/* ------------------------------------------------- nilai form (string semua) */

export interface MarkSchemeRowValues {
  /** Posisi tetap di database (tidak berubah walau baris lain dihapus). */
  position: number;
  descriptionMd: string;
  /** Input angka disimpan sebagai teks supaya bisa dikosongkan. */
  points: string;
}

export interface QuestionFormValues {
  id: string | null;
  releaseDate: string;
  title: string;
  topic: string;
  difficulty: string;
  bodyLatex: string;
  imagePath: string | null;
  answerType: AnswerType;
  /** Satu jawaban per baris. */
  acceptedAnswersText: string;
  toleranceText: string;
  markScheme: MarkSchemeRowValues[];
}

/** YYYY-MM-DD dari kalender WIB; dipakai untuk nilai awal tanggal rilis (S-2). */
export function wibDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Menambah hari pada string tanggal `YYYY-MM-DD` tanpa tergantung zona waktu alat. */
export function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const base = Date.UTC(year, month - 1, day) + days * 24 * 60 * 60 * 1000;
  return new Date(base).toISOString().slice(0, 10);
}

export function emptyQuestionFormValues(releaseDate: string): QuestionFormValues {
  return {
    id: null,
    releaseDate,
    title: '',
    topic: '',
    difficulty: '',
    bodyLatex: '',
    imagePath: null,
    answerType: 'integer',
    acceptedAnswersText: '',
    toleranceText: '',
    markScheme: [{ position: 1, descriptionMd: '', points: String(SCORING_STEP_DEFAULT) }],
  };
}

/** Poin awal satu kriteria baru; tetap di bawah batas `SCORING.stepsMax`. */
export function toQuestionFormValues(record: QuestionEditorRecord): QuestionFormValues {
  return {
    id: record.id,
    releaseDate: record.releaseDate,
    title: record.title,
    topic: record.topic ?? '',
    difficulty: record.difficulty === null ? '' : String(record.difficulty),
    bodyLatex: record.bodyLatex,
    imagePath: record.imagePath,
    answerType: record.answerKey?.answerType ?? 'integer',
    acceptedAnswersText: (record.answerKey?.acceptedAnswers ?? []).join('\n'),
    toleranceText:
      record.answerKey?.tolerance === null || record.answerKey?.tolerance === undefined
        ? ''
        : String(record.answerKey.tolerance),
    markScheme:
      record.markScheme.length > 0
        ? record.markScheme.map((row) => ({
            position: row.position,
            descriptionMd: row.descriptionMd,
            points: String(row.points),
          }))
        : [],
  };
}

/** Satu jawaban per baris; baris kosong dibuang dan duplikat dirapikan. */
export function parseAcceptedAnswers(text: string): string[] {
  const seen = new Set<string>();
  const answers: string[] = [];
  for (const line of text.split('\n')) {
    const answer = line.trim();
    if (!answer || seen.has(answer)) continue;
    seen.add(answer);
    answers.push(answer);
  }
  return answers;
}

export function parseTolerance(text: string, answerType: AnswerType): number | null {
  if (answerType !== 'decimal') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function difficultyFromForm(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
}

/** Baris mark scheme yang benar-benar diisi admin (posisi tetap dipertahankan). */
export function markSchemeRowsToSave(
  rows: readonly MarkSchemeRowValues[],
): SaveQuestionInput['markScheme'] {
  return rows
    .filter((row) => row.descriptionMd.trim().length > 0)
    .map((row) => ({
      position: row.position,
      descriptionMd: row.descriptionMd.trim(),
      points: Number.parseInt(row.points || '0', 10),
    }));
}

/** Angka baris berikutnya; selalu lebih besar dari posisi terbesar yang ada. */
export function nextMarkSchemePosition(rows: readonly MarkSchemeRowValues[]): number {
  return rows.reduce((max, row) => Math.max(max, row.position), 0) + 1;
}

/** Menyusun payload untuk server action dari nilai form. */
export function toSaveQuestionInput(values: QuestionFormValues): SaveQuestionInput {
  const acceptedAnswers = parseAcceptedAnswers(values.acceptedAnswersText);

  return {
    id: values.id,
    question: {
      releaseDate: values.releaseDate.trim(),
      title: values.title.trim(),
      bodyLatex: values.bodyLatex.trim(),
      topic: values.topic.trim() === '' ? undefined : values.topic.trim(),
      difficulty: difficultyFromForm(values.difficulty),
      imagePath: values.imagePath,
    },
    answerKey:
      acceptedAnswers.length > 0
        ? {
            answerType: values.answerType,
            acceptedAnswers,
            tolerance: parseTolerance(values.toleranceText, values.answerType),
          }
        : null,
    markScheme: markSchemeRowsToSave(values.markScheme),
  };
}

/** Bagian yang belum lengkap; dipakai peringatan Q-3 sebelum dan sesudah menyimpan. */
export function missingSections(input: {
  answerKey: object | null;
  markScheme: readonly unknown[];
}): MissingSection[] {
  const missing: MissingSection[] = [];
  if (!input.answerKey) missing.push('key');
  if (input.markScheme.length === 0) missing.push('markScheme');
  return missing;
}

export function missingSectionsCopy(missing: readonly MissingSection[]): string {
  const parts: string[] = [];
  if (missing.includes('key')) parts.push('kunci jawaban');
  if (missing.includes('markScheme')) parts.push('mark scheme');
  if (parts.length === 0) return '';
  if (parts.length === 1) return `${parts[0][0].toUpperCase()}${parts[0].slice(1)} belum diisi.`;
  return `${parts[0][0].toUpperCase()}${parts[0].slice(1)} dan ${parts[1]} belum diisi.`;
}

/* ----------------------------------------------------------- jendela waktu */

export function formatReleaseWindow(releaseDate: string): string {
  const releaseAt = releaseAtFor(releaseDate);
  const closesAt = closesAtFor(releaseAt);
  return `Rilis ${formatWib(releaseAt)} WIB · tutup ${formatWib(closesAt)} WIB`;
}

/** Tanggal rilis (kalender WIB) tanpa jam — dipakai di peringatan gap (Q-2). */
export function formatWibDate(releaseDate: string): string {
  return formatWib(releaseAtFor(releaseDate), { timeStyle: undefined });
}

/**
 * Memisahkan tanggal dan jam WIB dari satu instan, supaya kalimat
 * "Soal berikutnya rilis {tanggal} pukul {jam} WIB" bisa disusun (S-2).
 */
export function formatWibParts(date: Date): { date: string; time: string } {
  return {
    date: formatWib(date, { timeStyle: undefined }),
    time: formatWib(date, { dateStyle: undefined }),
  };
}

export type QuestionPhase = 'terjadwal' | 'terbuka' | 'ditutup';

export function questionPhase(
  question: Pick<QuestionOverview, 'releaseAt' | 'closesAt'>,
  now: Date,
): QuestionPhase {
  const releaseAt = new Date(question.releaseAt).getTime();
  const closesAt = new Date(question.closesAt).getTime();
  const current = now.getTime();
  if (current < releaseAt) return 'terjadwal';
  if (current < closesAt) return 'terbuka';
  return 'ditutup';
}

export function questionPhaseLabel(
  question: Pick<QuestionOverview, 'releaseAt' | 'closesAt'>,
  now: Date,
): string {
  const phase = questionPhase(question, now);
  if (phase === 'terjadwal') return `Rilis ${formatWib(new Date(question.releaseAt))} WIB`;
  if (phase === 'terbuka') return `Terbuka sampai ${formatWib(new Date(question.closesAt))} WIB`;
  return `Ditutup ${formatWib(new Date(question.closesAt))} WIB`;
}
