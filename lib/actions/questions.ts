'use server';

import { refresh, revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from '@/lib/actions/result';
import { requireAdmin } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { markSchemeSchema } from '@/lib/validation';
import { checkKatexText, describeKatexProblem } from '@/components/latex/katex-check';
import {
  QUESTION_IMAGE_MAX_BYTES,
  QUESTION_IMAGE_MIME_TYPES,
  missingSections,
  saveQuestionInputSchema,
  type MissingSection,
} from '@/app/admin/soal/payload';

/**
 * Aksi admin untuk menulis soal, kunci jawaban, mark scheme, dan gambar
 * (Q-1..Q-4). Setiap aksi:
 *  1. memanggil `requireAdmin()` SEBELUM menyentuh klien service role
 *     (AGENTS.md aturan keras 5, docs/SECURITY.md);
 *  2. memvalidasi masukannya dengan skema Zod yang sama dipakai form
 *     (`app/admin/soal/payload.ts` + `lib/validation.ts`);
 *  3. memeriksa LaTeX dengan KaTeX sebelum menulis (Q-1) — pemeriksaan di klien
 *     hanya untuk UX, penjaga sesungguhnya di sini;
 *  4. mengembalikan pesan Bahasa Indonesia, tidak pernah pesan Postgres mentah.
 */

const QUESTION_MEDIA_BUCKET = 'question-media';
/** Batas sama dengan bucket; dipakai juga oleh form di klien. */
const QUESTION_MEDIA_MAX_BYTES = QUESTION_IMAGE_MAX_BYTES;
const QUESTION_MEDIA_TYPES = QUESTION_IMAGE_MIME_TYPES;
/** URL bertanda tangan hanya untuk pratinjau admin; sebentar saja. */
const SIGNED_URL_TTL_SECONDS = 60 * 30;

export interface SaveQuestionResult {
  id: string;
  /** Q-3: bagian yang masih kosong — soal tetap tersimpan sebagai draf. */
  missing: MissingSection[];
}

export interface UploadImageResult {
  /** Path objek di dalam bucket; inilah nilai `questions.image_path`. */
  path: string;
  /** URL bertanda tangan untuk pratinjau (null kalau gagal dibuat). */
  url: string | null;
}

const questionIdSchema = z.uuid('Soal tidak dikenal.');

const uploadImageSchema = z.object({
  releaseDate: z.iso.date('Tanggal rilis tidak valid.'),
  file: z
    .file('Pilih gambar dulu.')
    .min(1, 'Berkas gambar kosong.')
    .max(QUESTION_MEDIA_MAX_BYTES, 'Gambar maksimal 8 MB.')
    .mime([...QUESTION_MEDIA_TYPES], 'Format gambar harus JPG, PNG, atau WebP.'),
});

function extensionFor(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

/** Q-2: `release_date` unik; jangan bocorkan pesan Postgres mentah ke admin. */
function questionWriteError(error: { message?: string; code?: string } | null): ActionResult<never> {
  if (error?.code === '23505') {
    return fail('Sudah ada soal untuk tanggal ini. Pilih tanggal lain, atau edit soal yang sudah ada.', {
      releaseDate: ['Tanggal ini sudah dipakai soal lain.'],
    });
  }
  return fromDatabaseError(error);
}

function revalidateQuestionPaths(questionId: string): void {
  revalidatePath('/admin');
  revalidatePath('/admin/soal');
  revalidatePath(`/admin/soal/${questionId}`);
}

function checkLatexOrFail(
  fields: ReadonlyArray<{ field: string; label: string; value: string }>,
): ActionResult<never> | null {
  for (const item of fields) {
    const result = checkKatexText(item.value);
    if (result.ok) continue;
    const message = describeKatexProblem(result.problems[0]);
    return fail(`${item.label}: ${message}`, { [item.field]: [message] });
  }
  return null;
}

/**
 * Q-1, Q-2, Q-3: membuat atau memperbarui soal beserta kunci dan mark scheme.
 *
 * Kebijakan draf (Q-3): soal TANPA kunci atau TANPA mark scheme tetap boleh
 * disimpan, dan hasilnya melaporkan bagian yang belum lengkap supaya UI bisa
 * menampilkan peringatan. Yang tidak bisa disimpan adalah LaTeX yang tidak bisa
 * diparse KaTeX.
 */
export async function saveQuestion(input: unknown): Promise<ActionResult<SaveQuestionResult>> {
  const user = await requireAdmin();

  const parsed = saveQuestionInputSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const payload = parsed.data;

  // Q-3: aturan penuh mark scheme (posisi unik, total <= SCORING.stepsMax) dari
  // skema bersama; hanya berlaku kalau kriterianya benar-benar diisi.
  let markScheme = payload.markScheme;
  if (markScheme.length > 0) {
    const scheme = markSchemeSchema.safeParse(markScheme);
    if (!scheme.success) return fromZodError(scheme.error);
    markScheme = scheme.data;
  }

  const latexProblem = checkLatexOrFail([
    { field: 'bodyLatex', label: 'Isi soal', value: payload.question.bodyLatex },
    ...markScheme.map((row, index) => ({
      field: `markScheme.${index}.descriptionMd`,
      label: `Kriteria ${index + 1}`,
      value: row.descriptionMd,
    })),
  ]);
  if (latexProblem) return latexProblem;

  const db = createSupabaseAdminClient();

  const fields = {
    release_date: payload.question.releaseDate,
    title: payload.question.title,
    body_latex: payload.question.bodyLatex,
    topic: payload.question.topic ?? null,
    difficulty: payload.question.difficulty,
    image_path: payload.question.imagePath,
  };

  let questionId = payload.id;
  let previousImagePath: string | null = null;

  if (questionId) {
    const { data: existing, error: readError } = await db
      .from('questions')
      .select('id, image_path')
      .eq('id', questionId)
      .maybeSingle();

    if (readError) return fromDatabaseError(readError);
    if (!existing) return fail('Soal tidak ditemukan. Mungkin sudah dihapus.');

    previousImagePath = existing.image_path;
    const { error } = await db.from('questions').update(fields).eq('id', questionId);
    if (error) return questionWriteError(error);
  } else {
    const { data: created, error } = await db
      .from('questions')
      .insert({ ...fields, created_by: user.id })
      .select('id')
      .single();

    if (error) return questionWriteError(error);
    questionId = created.id;
  }

  // Kunci jawaban: upsert kalau diisi, hapus kalau dikosongkan (supaya indikator
  // "kunci lengkap" di daftar soal jujur, Q-3).
  if (payload.answerKey) {
    const { error } = await db.from('question_keys').upsert(
      {
        question_id: questionId,
        answer_type: payload.answerKey.answerType,
        accepted_answers: payload.answerKey.acceptedAnswers,
        tolerance: payload.answerKey.tolerance,
      },
      { onConflict: 'question_id' },
    );
    if (error) {
      return fail(
        'Soal tersimpan, tetapi kunci jawaban gagal disimpan. Coba simpan lagi sebentar lagi.',
      );
    }
  } else {
    const { error } = await db.from('question_keys').delete().eq('question_id', questionId);
    if (error) {
      return fail(
        'Soal tersimpan, tetapi kunci jawaban lama gagal dihapus. Coba simpan lagi sebentar lagi.',
      );
    }
  }

  // Mark scheme: diganti seluruhnya, karena `position` adalah bagian dari
  // identitas kriteria (dipakai `grades.criteria_ticks`).
  const { error: clearSchemeError } = await db
    .from('question_markschemes')
    .delete()
    .eq('question_id', questionId);
  if (clearSchemeError) {
    return fail('Soal tersimpan, tetapi mark scheme gagal diperbarui. Coba simpan lagi sebentar lagi.');
  }

  if (markScheme.length > 0) {
    const { error } = await db.from('question_markschemes').insert(
      markScheme.map((row) => ({
        question_id: questionId,
        position: row.position,
        description_md: row.descriptionMd,
        points: row.points,
      })),
    );
    if (error) {
      return fail(
        'Soal tersimpan, tetapi mark scheme gagal disimpan. Coba simpan lagi sebentar lagi.',
      );
    }
  }

  // Gambar lama dibuang kalau diganti. Kegagalan di sini tidak menggagalkan
  // penyimpanan; berkas yatim tidak berbahaya (docs/ARCHITECTURE.md).
  if (previousImagePath && previousImagePath !== payload.question.imagePath) {
    try {
      await db.storage.from(QUESTION_MEDIA_BUCKET).remove([previousImagePath]);
    } catch {
      // diabaikan dengan sengaja
    }
  }

  revalidateQuestionPaths(questionId);
  refresh();

  return ok({ id: questionId, missing: missingSections(payload) });
}

/**
 * Q-4: soal yang sudah punya kiriman tidak boleh dihapus, hanya diedit.
 * Dipastikan lagi di server, bukan hanya di UI.
 */
export async function deleteQuestion(id: unknown): Promise<ActionResult<undefined>> {
  await requireAdmin();

  const parsed = questionIdSchema.safeParse(id);
  if (!parsed.success) return fromZodError(parsed.error);
  const questionId = parsed.data;

  const db = createSupabaseAdminClient();

  const { data: question, error: readError } = await db
    .from('questions')
    .select('id, image_path')
    .eq('id', questionId)
    .maybeSingle();

  if (readError) return fromDatabaseError(readError);
  if (!question) return fail('Soal tidak ditemukan. Mungkin sudah dihapus.');

  const { count, error: countError } = await db
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('question_id', questionId);

  if (countError) return fromDatabaseError(countError);
  if ((count ?? 0) > 0) {
    return fail(
      'Soal ini sudah punya kiriman anggota, jadi tidak bisa dihapus. Kamu masih bisa mengeditnya.',
    );
  }

  // Anak-anak dulu supaya tidak melanggar foreign key.
  const childDeletes = await Promise.all([
    db.from('question_keys').delete().eq('question_id', questionId),
    db.from('question_markschemes').delete().eq('question_id', questionId),
    db.from('question_solutions').delete().eq('question_id', questionId),
  ]);
  const childError = childDeletes.find((result) => result.error)?.error;
  if (childError) return fromDatabaseError(childError);

  const { error: deleteError } = await db.from('questions').delete().eq('id', questionId);
  if (deleteError) return fromDatabaseError(deleteError);

  if (question.image_path) {
    try {
      await db.storage.from(QUESTION_MEDIA_BUCKET).remove([question.image_path]);
    } catch {
      // diabaikan dengan sengaja
    }
  }

  revalidatePath('/admin');
  revalidatePath('/admin/soal');
  refresh();

  return ok(undefined);
}

/**
 * Unggah gambar soal ke bucket privat `question-media` lewat klien service role.
 * Yang disimpan di `questions.image_path` adalah path objek, bukan URL
 * (docs/DATA_MODEL.md). Berkas yatim (admin mengunggah lalu tidak menyimpan)
 * tidak berbahaya.
 */
export async function uploadQuestionImage(
  formData: FormData,
): Promise<ActionResult<UploadImageResult>> {
  await requireAdmin();

  const parsed = uploadImageSchema.safeParse({
    releaseDate: formData.get('releaseDate'),
    file: formData.get('file'),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const db = createSupabaseAdminClient();
  const extension = extensionFor(parsed.data.file.type);
  const path = `${parsed.data.releaseDate}/${crypto.randomUUID()}.${extension}`;

  const { error } = await db.storage.from(QUESTION_MEDIA_BUCKET).upload(path, parsed.data.file, {
    contentType: parsed.data.file.type,
    upsert: false,
  });
  if (error) return fail('Gambar gagal diunggah. Coba lagi.');

  const { data } = await db.storage
    .from(QUESTION_MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  return ok({ path, url: data?.signedUrl ?? null });
}
