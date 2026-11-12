import { z } from 'zod';
import { LIMITS, SCORING } from './config';

/**
 * Shared Zod schemas. Every server action validates its input with one of these
 * (AGENTS.md conventions) and the forms reuse the same schema through
 * `@hookform/resolvers/zod`, so the two can never drift.
 *
 * Messages are Bahasa Indonesia and shown to users as-is — never a raw
 * database or Postgrest message.
 */

const nonEmpty = (label: string, max?: number) =>
  max === undefined
    ? z.string().trim().min(1, `${label} wajib diisi.`)
    : z.string().trim().min(1, `${label} wajib diisi.`).max(max, `${label} maksimal ${max} karakter.`);

/* ------------------------------------------------------------------ auth */

export const emailSchema = z.email('Format email tidak valid.').trim().toLowerCase();

/** A-3 / A-7: minimum 8 characters. */
export const passwordSchema = z.string().min(8, 'Kata sandi minimal 8 karakter.');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
});

export const changePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak sama.',
    path: ['confirmPassword'],
  });

/* ---------------------------------------------------------- submissions */

export const finalAnswerSchema = z
  .string()
  .trim()
  .min(1, 'Jawaban akhir wajib diisi.')
  .max(LIMITS.finalAnswerMaxChars, `Jawaban akhir maksimal ${LIMITS.finalAnswerMaxChars} karakter.`);

/** M-2: at least one photo or some typed text, max 5 photos. */
export const stepsSchema = z
  .object({
    stepsText: z.string().trim().max(4000, 'Langkah pengerjaan terlalu panjang.').optional(),
    photoPaths: z
      .array(z.string().trim().min(1))
      .max(LIMITS.stepPhotosMax, `Maksimal ${LIMITS.stepPhotosMax} foto.`)
      .default([]),
  })
  .refine((v) => Boolean(v.stepsText) || v.photoPaths.length > 0, {
    message: 'Lampirkan minimal satu foto atau tulis langkah pengerjaanmu.',
    path: ['stepsText'],
  });

export const submitAnswerSchema = z.object({
  questionId: z.uuid('Soal tidak dikenal.'),
  finalAnswer: finalAnswerSchema,
  steps: stepsSchema,
});

export const guestAnswerSchema = z.object({
  questionId: z.uuid('Soal tidak dikenal.'),
  answer: z.string().trim().min(1, 'Tulis jawabanmu dulu.').max(LIMITS.finalAnswerMaxChars),
});

/* ----------------------------------------------------------- questions */

export const ANSWER_TYPES = ['integer', 'fraction', 'decimal', 'text'] as const;

export const answerKeySchema = z.object({
  answerType: z.enum(ANSWER_TYPES, 'Tipe jawaban tidak dikenal.'),
  acceptedAnswers: z
    .array(z.string().trim().min(1))
    .min(1, 'Isi minimal satu jawaban yang diterima.'),
  tolerance: z.number().nonnegative().nullable().default(null),
});

export const markSchemeItemSchema = z.object({
  position: z.number().int().positive(),
  descriptionMd: nonEmpty('Deskripsi kriteria'),
  points: z.number().int().min(0).max(SCORING.stepsMax),
});

/** Q-3: criteria must be present. Their sum is the steps points (0-5). */
export const markSchemeSchema = z
  .array(markSchemeItemSchema)
  .min(1, 'Mark scheme wajib diisi.')
  .refine((items) => new Set(items.map((i) => i.position)).size === items.length, {
    message: 'Posisi kriteria tidak boleh kembar.',
  })
  .refine((items) => items.reduce((sum, i) => sum + i.points, 0) <= SCORING.stepsMax, {
    message: `Total poin mark scheme maksimal ${SCORING.stepsMax}.`,
  });

export const questionSchema = z.object({
  // WIB calendar date. `release_at`/`closes_at` are generated from this (S-1).
  releaseDate: z.iso.date('Tanggal rilis tidak valid.'),
  title: nonEmpty('Judul', 200),
  bodyLatex: nonEmpty('Isi soal', 8000),
  topic: z.string().trim().max(80).optional(),
  difficulty: z.number().int().min(1).max(5).nullable().default(null),
  imagePath: z.string().trim().nullable().default(null),
});

/* -------------------------------------------------------------- grading */

export const saveGradeSchema = z.object({
  submissionId: z.uuid('Kiriman tidak dikenal.'),
  isCorrect: z.boolean(),
  /** Mark-scheme `position` values that were ticked. */
  criteriaTicks: z.array(z.number().int().positive()).default([]),
  privateFeedback: z.string().trim().max(2000, 'Catatan maksimal 2000 karakter.').optional(),
});

/* ----------------------------------------------------------- members */

export const updateMemberSchema = z.object({
  userId: z.uuid('Anggota tidak dikenal.'),
  displayName: nonEmpty('Nama', 120),
  className: z.string().trim().max(40).nullable().default(null),
});

export const importMembersSchema = z.object({
  // Raw CSV text pasted or uploaded by an admin (U-1).
  csv: z.string().trim().min(1, 'Isi CSV masih kosong.'),
});

export const osnDateSchema = z.object({
  osnDate: z.iso.date('Tanggal OSN tidak valid.').nullable(),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type AnswerKeyInput = z.infer<typeof answerKeySchema>;
export type SaveGradeInput = z.infer<typeof saveGradeSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
