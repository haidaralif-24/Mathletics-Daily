'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ImagePlusIcon, Loader2Icon, PlusIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { LatexField } from '@/components/latex/latex-field';
import { checkKatexText, describeKatexProblem } from '@/components/latex/katex-check';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { deleteQuestion, saveQuestion, uploadQuestionImage } from '@/lib/actions/questions';
import { SCORING } from '@/lib/config';
import { markSchemeSchema } from '@/lib/validation';
import {
  ANSWER_TYPE_LABELS,
  MAX_MARK_SCHEME_ROWS,
  QUESTION_IMAGE_MAX_BYTES,
  QUESTION_IMAGE_MIME_TYPES,
  formatReleaseWindow,
  missingSections,
  missingSectionsCopy,
  nextMarkSchemePosition,
  parseAcceptedAnswers,
  parseTolerance,
  saveQuestionInputSchema,
  toSaveQuestionInput,
  type AnswerType,
  type MarkSchemeRowValues,
  type MissingSection,
  type QuestionFormValues,
} from './payload';

/**
 * Editor soal (Q-1, Q-2, Q-3, Q-4).
 *
 * Keputusan draf (Q-3): soal tanpa kunci jawaban atau tanpa mark scheme tetap
 * BISA disimpan, tetapi admin diberi peringatan lebih dulu dan hasil simpan
 * melaporkan bagian yang belum lengkap. Yang benar-benar memblokir penyimpanan
 * hanya LaTeX yang tidak bisa diparse KaTeX (Q-1) — diperiksa di klien untuk
 * umpan balik, dan diulang di server action sebagai penjaga.
 */

const ANSWER_TYPE_ITEMS = (Object.keys(ANSWER_TYPE_LABELS) as AnswerType[]).map((value) => ({
  value,
  label: ANSWER_TYPE_LABELS[value],
}));

const DIFFICULTY_ITEMS = [
  { value: 'none', label: 'Belum ditandai' },
  { value: '1', label: '1 · Mudah' },
  { value: '2', label: '2' },
  { value: '3', label: '3 · Sedang' },
  { value: '4', label: '4' },
  { value: '5', label: '5 · Sulit' },
];

/** Urutan fokus saat ada beberapa kolom yang salah. */
const FIELD_ORDER = [
  'question-releaseDate',
  'question-title',
  'question-bodyLatex',
  'question-image',
  'answerKey-answerType',
  'answerKey-acceptedAnswers',
  'answerKey-tolerance',
  'markScheme',
];

const RELEASE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface QuestionFormProps {
  initialValues: QuestionFormValues;
  /** Q-4: soal dengan kiriman tidak boleh dihapus. */
  submissionCount: number;
  /** URL bertanda tangan untuk gambar yang sudah tersimpan (dibuat di server). */
  initialImageUrl: string | null;
}

export function QuestionForm({ initialValues, submissionCount, initialImageUrl }: QuestionFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<QuestionFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl);
  const [uploading, setUploading] = useState(false);
  const [draftWarning, setDraftWarning] = useState<MissingSection[] | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();

  const isEdit = values.id !== null;
  const canDelete = isEdit && submissionCount === 0;
  const acceptedAnswers = parseAcceptedAnswers(values.acceptedAnswersText);
  const schemeTotal = values.markScheme.reduce(
    (sum, row) => sum + (Number.parseInt(row.points, 10) || 0),
    0,
  );

  /* ------------------------------------------------------------ perubahan */

  function update<K extends keyof QuestionFormValues>(key: K, value: QuestionFormValues[K]): void {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  function clearError(field: string): void {
    setErrors((previous) => {
      if (!(field in previous)) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  function updateRow(position: number, patch: Partial<MarkSchemeRowValues>): void {
    setValues((previous) => ({
      ...previous,
      markScheme: previous.markScheme.map((row) =>
        row.position === position ? { ...row, ...patch } : row,
      ),
    }));
    clearError(`markScheme-${position}-descriptionMd`);
    clearError(`markScheme-${position}-points`);
    clearError('markScheme');
  }

  function addRow(): void {
    setValues((previous) => ({
      ...previous,
      markScheme: [
        ...previous.markScheme,
        {
          position: nextMarkSchemePosition(previous.markScheme),
          descriptionMd: '',
          points: '1',
        },
      ],
    }));
    clearError('markScheme');
  }

  function removeRow(position: number): void {
    setValues((previous) => ({
      ...previous,
      markScheme: previous.markScheme.filter((row) => row.position !== position),
    }));
    clearError('markScheme');
  }

  /* ------------------------------------------------------------ validasi */

  function katexProblems(formValues: QuestionFormValues): Record<string, string[]> {
    const found: Record<string, string[]> = {};

    const body = checkKatexText(formValues.bodyLatex);
    if (!body.ok) {
      found['question-bodyLatex'] = [describeKatexProblem(body.problems[0])];
    }

    for (const row of formValues.markScheme) {
      const result = checkKatexText(row.descriptionMd);
      if (!result.ok) {
        found[`markScheme-${row.position}-descriptionMd`] = [
          describeKatexProblem(result.problems[0]),
        ];
      }
    }

    return found;
  }

  function fieldIdForIssuePath(path: readonly PropertyKey[], formValues: QuestionFormValues): string {
    const [root, second, third] = path;

    if (root === 'question') {
      if (second === 'imagePath') return 'question-image';
      return typeof second === 'string' ? `question-${second}` : 'question';
    }
    if (root === 'answerKey') {
      return typeof second === 'string' ? `answerKey-${second}` : 'answerKey';
    }
    if (root === 'markScheme') {
      if (typeof second === 'number' && typeof third === 'string') {
        const position = formValues.markScheme[second]?.position;
        if (position !== undefined) return `markScheme-${position}-${third}`;
      }
      return 'markScheme';
    }
    return 'question';
  }

  /** Pemeriksaan sisi klien memakai skema yang sama dengan server action. */
  function validate(formValues: QuestionFormValues): {
    fieldErrors: Record<string, string[]>;
    message: string;
  } | null {
    const input = toSaveQuestionInput(formValues);
    const fieldErrors: Record<string, string[]> = {};

    const parsed = saveQuestionInputSchema.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = fieldIdForIssuePath(issue.path, formValues);
        (fieldErrors[field] ??= []).push(issue.message);
      }
    }

    if (input.markScheme.length > 0) {
      const scheme = markSchemeSchema.safeParse(input.markScheme);
      if (!scheme.success) {
        for (const issue of scheme.error.issues) {
          (fieldErrors.markScheme ??= []).push(issue.message);
        }
      }
      for (const row of formValues.markScheme) {
        if (row.descriptionMd.trim() === '') continue;
        const points = Number.parseInt(row.points, 10);
        if (!Number.isInteger(points) || points < 0 || points > SCORING.stepsMax) {
          (fieldErrors[`markScheme-${row.position}-points`] ??= []).push(
            `Poin harus bilangan bulat 0-${SCORING.stepsMax}.`,
          );
        }
      }
    }

    if (
      formValues.answerType === 'decimal' &&
      formValues.toleranceText.trim() !== '' &&
      parseTolerance(formValues.toleranceText, 'decimal') === null
    ) {
      (fieldErrors['answerKey-tolerance'] ??= []).push('Toleransi harus angka 0 atau lebih.');
    }

    for (const [field, messages] of Object.entries(katexProblems(formValues))) {
      (fieldErrors[field] ??= []).push(...messages);
    }

    if (Object.keys(fieldErrors).length === 0) return null;

    return {
      fieldErrors,
      message: 'Ada isian yang belum benar. Periksa kolom yang ditandai merah.',
    };
  }

  function focusFirstError(fieldErrors: Record<string, string[]>): void {
    const keys = Object.keys(fieldErrors);
    if (keys.length === 0) return;
    const ordered = [
      ...FIELD_ORDER.filter((field) => keys.includes(field)),
      ...keys.filter((field) => !FIELD_ORDER.includes(field)),
    ];
    const element = document.getElementById(ordered[0]);
    if (!(element instanceof HTMLElement)) return;
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.focus();
    element.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  /* -------------------------------------------------------------- simpan */

  function save(allowDraft: boolean): void {
    const problem = validate(values);
    if (problem) {
      setErrors(problem.fieldErrors);
      setFormMessage(problem.message);
      focusFirstError(problem.fieldErrors);
      toast.error('Periksa kembali isian yang ditandai.');
      return;
    }

    const input = toSaveQuestionInput(values);
    const missing = missingSections(input);
    if (missing.length > 0 && !allowDraft) {
      setDraftWarning(missing);
      return;
    }

    startSaving(async () => {
      try {
        const result = await saveQuestion(input);
        if (!result.ok) {
          setErrors(result.error.fieldErrors ?? {});
          setFormMessage(result.error.message);
          focusFirstError(result.error.fieldErrors ?? {});
          toast.error(result.error.message);
          return;
        }

        setErrors({});
        setFormMessage(null);

        if (result.data.missing.length > 0) {
          toast.warning('Soal tersimpan sebagai draf', {
            description: `${missingSectionsCopy(result.data.missing)} Anggota belum bisa dinilai sampai bagian itu lengkap.`,
          });
        } else {
          toast.success('Soal tersimpan');
        }

        if (!isEdit) router.push(`/admin/soal/${result.data.id}`);
      } catch {
        toast.error('Soal gagal disimpan. Coba lagi sebentar lagi.');
      }
    });
  }

  function remove(): void {
    if (values.id === null) return;
    const id = values.id;

    startDeleting(async () => {
      try {
        const result = await deleteQuestion(id);
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        setDeleteOpen(false);
        toast.success('Soal dihapus');
        router.push('/admin/soal');
      } catch {
        toast.error('Soal gagal dihapus. Coba lagi sebentar lagi.');
      }
    });
  }

  /* -------------------------------------------------------------- gambar */

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!RELEASE_DATE_PATTERN.test(values.releaseDate.trim())) {
      toast.error('Isi tanggal rilis dulu sebelum mengunggah gambar.');
      return;
    }
    if (file.size > QUESTION_IMAGE_MAX_BYTES) {
      toast.error('Gambar maksimal 8 MB.');
      return;
    }
    if (!(QUESTION_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error('Format gambar harus JPG, PNG, atau WebP.');
      return;
    }

    const formData = new FormData();
    formData.set('releaseDate', values.releaseDate.trim());
    formData.set('file', file);

    setUploading(true);
    try {
      const result = await uploadQuestionImage(formData);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      update('imagePath', result.data.path);
      setImageUrl(result.data.url);
      toast.success('Gambar terunggah');
    } catch {
      toast.error('Gambar gagal diunggah. Coba lagi.');
    } finally {
      setUploading(false);
    }
  }

  function removeImage(): void {
    update('imagePath', null);
    setImageUrl(null);
    toast.info('Gambar dihapus saat soal disimpan.');
  }

  /* ------------------------------------------------------------- render */

  const busy = saving || deleting || uploading;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save(false);
      }}
    >
      {formMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <p className="font-medium">{formMessage}</p>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Soal</CardTitle>
          <CardDescription>
            Judul dan isi soal. Rumus ditulis di antara <code>$...$</code> (inline) atau{' '}
            <code>$$...$$</code> (blok).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="question-releaseDate">Tanggal rilis (WIB)</Label>
              <Input
                id="question-releaseDate"
                type="date"
                value={values.releaseDate}
                onChange={(event) => {
                  update('releaseDate', event.target.value);
                  clearError('question-releaseDate');
                  clearError('question-image');
                }}
                required
                aria-invalid={errors['question-releaseDate'] ? true : undefined}
                aria-describedby="question-releaseDate-hint"
                className="min-h-11"
              />
              <p id="question-releaseDate-hint" className="text-xs text-muted-foreground">
                {RELEASE_DATE_PATTERN.test(values.releaseDate.trim())
                  ? formatReleaseWindow(values.releaseDate.trim())
                  : 'Jendela soal dihitung otomatis: rilis 04.00 WIB, tutup 24 jam kemudian.'}
              </p>
              {errors['question-releaseDate'] ? (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {errors['question-releaseDate'][0]}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <span id="question-difficulty-label" className="text-sm font-medium">
                Tingkat kesulitan
              </span>
              <Select
                items={DIFFICULTY_ITEMS}
                value={values.difficulty === '' ? 'none' : values.difficulty}
                onValueChange={(value) => {
                  if (typeof value === 'string') {
                    update('difficulty', value === 'none' ? '' : value);
                  }
                }}
              >
                <SelectTrigger
                  id="question-difficulty"
                  className="min-h-11 w-full"
                  aria-labelledby="question-difficulty-label"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="question-title">Judul</Label>
            <Input
              id="question-title"
              value={values.title}
              onChange={(event) => {
                update('title', event.target.value);
                clearError('question-title');
              }}
              maxLength={200}
              placeholder="Misalnya: Jumlah akar persamaan kuadrat"
              required
              aria-invalid={errors['question-title'] ? true : undefined}
            />
            {errors['question-title'] ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {errors['question-title'][0]}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="question-topic">Topik (opsional)</Label>
            <Input
              id="question-topic"
              value={values.topic}
              onChange={(event) => {
                update('topic', event.target.value);
                clearError('question-topic');
              }}
              maxLength={80}
              placeholder="Misalnya: Aljabar, Geometri, Teori bilangan"
              aria-invalid={errors['question-topic'] ? true : undefined}
            />
          </div>

          <LatexField
            id="question-bodyLatex"
            label="Isi soal"
            hint="Dukungan markdown sederhana (tebal, miring, daftar) dan LaTeX. Rumus blok menggeser mendatar kalau panjang."
            value={values.bodyLatex}
            onChange={(value) => {
              update('bodyLatex', value);
              clearError('question-bodyLatex');
            }}
            rows={8}
            withToolbar
            withPreview
            error={errors['question-bodyLatex']?.[0]}
            placeholder={'Tentukan jumlah akar dari $x^2 - 5x + 6 = 0$.'}
            maxLength={8000}
          />

          <div id="question-image" tabIndex={-1} className="flex flex-col gap-2 outline-none">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">Gambar soal (opsional)</span>
              {values.imagePath ? (
                <span className="text-xs text-muted-foreground">
                  Tersimpan: <code className="font-mono">{values.imagePath}</code>
                </span>
              ) : null}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={QUESTION_IMAGE_MIME_TYPES.join(',')}
              className="sr-only"
              aria-label="Pilih gambar soal"
              onChange={handleFile}
            />

            {values.imagePath ? (
              <div className="flex flex-col gap-2">
                {imageUrl ? (
                  // URL bertanda tangan dari Supabase Storage; host-nya belum
                  // terdaftar di next.config images, jadi <img> dipakai di sini.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt="Pratinjau gambar soal"
                    className="max-h-64 w-full max-w-md rounded-lg border border-border bg-card object-contain"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Pratinjau tidak tersedia. Gambar tetap terpasang saat soal disimpan.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 px-4"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlusIcon aria-hidden="true" />
                    Ganti gambar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 px-4"
                    disabled={busy}
                    onClick={removeImage}
                  >
                    <Trash2Icon aria-hidden="true" />
                    Hapus gambar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 px-4"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadIcon aria-hidden="true" />
                  Unggah gambar
                </Button>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, atau WebP, maksimal 8 MB. Gambar tampil untuk anggota setelah soal rilis.
                </p>
              </div>
            )}

            {uploading ? (
              <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2Icon className="size-3 animate-spin" aria-hidden="true" />
                Mengunggah gambar...
              </p>
            ) : null}

            {errors['question-image'] ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {errors['question-image'][0]}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Kunci jawaban ---------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Kunci jawaban</CardTitle>
          <CardDescription>
            Hanya admin yang bisa membaca kunci. Anggota tidak pernah menerimanya dari server (Q-3).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <fieldset id="answerKey" tabIndex={-1} className="flex flex-col gap-4 outline-none">
            <legend className="sr-only">Kunci jawaban</legend>

            <div className="flex flex-col gap-1.5">
              <span id="answerKey-answerType-label" className="text-sm font-medium">
                Tipe jawaban
              </span>
              <Select
                items={ANSWER_TYPE_ITEMS}
                value={values.answerType}
                onValueChange={(value) => {
                  if (typeof value === 'string') {
                    update('answerType', value as AnswerType);
                    clearError('answerKey-tolerance');
                  }
                }}
              >
                <SelectTrigger
                  id="answerKey-answerType"
                  className="min-h-11 w-full sm:w-64"
                  aria-labelledby="answerKey-answerType-label"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANSWER_TYPE_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="answerKey-acceptedAnswers">Jawaban yang diterima</Label>
              <Textarea
                id="answerKey-acceptedAnswers"
                rows={3}
                value={values.acceptedAnswersText}
                onChange={(event) => {
                  update('acceptedAnswersText', event.target.value);
                  clearError('answerKey-acceptedAnswers');
                  clearError('answerKey');
                }}
                placeholder={'3/4\n0,75\nsqrt(2)'}
                aria-invalid={errors['answerKey-acceptedAnswers'] ? true : undefined}
                aria-describedby="answerKey-acceptedAnswers-hint"
                className="min-h-11"
              />
              <p id="answerKey-acceptedAnswers-hint" className="text-xs text-muted-foreground">
                Satu jawaban per baris. {acceptedAnswers.length} jawaban terbaca. Pencocokan
                mengabaikan spasi, huruf besar/kecil, dan koma atau titik desimal.
              </p>
              {errors['answerKey-acceptedAnswers'] ? (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {errors['answerKey-acceptedAnswers'][0]}
                </p>
              ) : null}
            </div>

            {values.answerType === 'decimal' ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="answerKey-tolerance">Toleransi (opsional)</Label>
                <Input
                  id="answerKey-tolerance"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={values.toleranceText}
                  onChange={(event) => {
                    update('toleranceText', event.target.value);
                    clearError('answerKey-tolerance');
                  }}
                  aria-invalid={errors['answerKey-tolerance'] ? true : undefined}
                  aria-describedby="answerKey-tolerance-hint"
                  className="min-h-11 sm:max-w-40"
                />
                <p id="answerKey-tolerance-hint" className="text-xs text-muted-foreground">
                  Selisih yang masih dianggap benar, misalnya 0,01.
                </p>
                {errors['answerKey-tolerance'] ? (
                  <p role="alert" className="text-xs font-medium text-destructive">
                    {errors['answerKey-tolerance'][0]}
                  </p>
                ) : null}
              </div>
            ) : null}
          </fieldset>
        </CardContent>
      </Card>

      {/* Mark scheme ------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>Mark scheme</CardTitle>
          <CardDescription>
            Kriteria penilaian langkah pengerjaan. Total poin maksimal {SCORING.stepsMax}; poin
            inilah yang diberikan admin saat menilai.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <fieldset id="markScheme" tabIndex={-1} className="flex flex-col gap-3 outline-none">
            <legend className="sr-only">Mark scheme</legend>

            {values.markScheme.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada kriteria. Soal tetap bisa disimpan sebagai draf, tetapi langkah
                pengerjaan belum bisa diberi poin.
              </p>
            ) : null}

            {values.markScheme.map((row, index) => (
              <div key={row.position} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Kriteria {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Hapus kriteria ${index + 1}`}
                    title={`Hapus kriteria ${index + 1}`}
                    disabled={busy}
                    onClick={() => removeRow(row.position)}
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </div>

                <LatexField
                  id={`markScheme-${row.position}-descriptionMd`}
                  label="Deskripsi kriteria"
                  value={row.descriptionMd}
                  onChange={(value) => updateRow(row.position, { descriptionMd: value })}
                  rows={2}
                  placeholder={'Menuliskan $x_1 + x_2 = 5$'}
                  error={errors[`markScheme-${row.position}-descriptionMd`]?.[0]}
                />

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`markScheme-${row.position}-points`}>Poin</Label>
                  <Input
                    id={`markScheme-${row.position}-points`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={SCORING.stepsMax}
                    step={1}
                    value={row.points}
                    onChange={(event) => updateRow(row.position, { points: event.target.value })}
                    aria-invalid={errors[`markScheme-${row.position}-points`] ? true : undefined}
                    className="min-h-11 sm:max-w-28"
                  />
                  {errors[`markScheme-${row.position}-points`] ? (
                    <p role="alert" className="text-xs font-medium text-destructive">
                      {errors[`markScheme-${row.position}-points`][0]}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 px-4"
                disabled={busy || values.markScheme.length >= MAX_MARK_SCHEME_ROWS}
                onClick={addRow}
              >
                <PlusIcon aria-hidden="true" />
                Tambah kriteria
              </Button>
              <p
                className={
                  schemeTotal > SCORING.stepsMax
                    ? 'text-xs font-medium text-destructive'
                    : 'text-xs text-muted-foreground'
                }
                aria-live="polite"
              >
                Total poin {schemeTotal} dari maksimal {SCORING.stepsMax}
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Baris tanpa deskripsi diabaikan saat menyimpan.
            </p>

            {errors.markScheme ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {errors.markScheme[0]}
              </p>
            ) : null}
          </fieldset>
        </CardContent>
      </Card>

      {/* Aksi ------------------------------------------------------------- */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            className="min-h-11 px-5"
            disabled={busy}
            aria-busy={saving}
          >
            {saving ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
            {saving ? 'Menyimpan...' : isEdit ? 'Simpan perubahan' : 'Simpan soal'}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="min-h-11 px-4"
            disabled={busy}
            onClick={() => router.push('/admin/soal')}
          >
            Batal
          </Button>

          {isEdit ? (
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 px-4"
              disabled={busy || !canDelete}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon aria-hidden="true" />
              Hapus soal
            </Button>
          ) : null}
        </div>

        {isEdit && !canDelete ? (
          <p className="text-xs text-muted-foreground">
            Soal ini sudah punya {submissionCount} kiriman anggota, jadi tidak bisa dihapus. Kamu
            masih bisa mengeditnya.
          </p>
        ) : null}
      </div>

      {/* Peringatan draf (Q-3) ------------------------------------------- */}
      <Dialog
        open={draftWarning !== null}
        onOpenChange={(open) => {
          if (!open) setDraftWarning(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simpan sebagai draf?</DialogTitle>
            <DialogDescription>
              {missingSectionsCopy(draftWarning ?? [])} Soal tetap bisa disimpan, tetapi anggota
              belum bisa dinilai sampai bagian itu lengkap.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="min-h-11 px-4" onClick={() => setDraftWarning(null)}>
              Batal
            </Button>
            <Button
              className="min-h-11 px-4"
              onClick={() => {
                setDraftWarning(null);
                save(true);
              }}
            >
              Simpan sebagai draf
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi hapus (Q-4) ------------------------------------------ */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus soal ini?</DialogTitle>
            <DialogDescription>
              Soal beserta kunci jawaban dan mark scheme-nya akan dihapus permanen. Tindakan ini
              tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="min-h-11 px-4"
              disabled={deleting}
              onClick={() => setDeleteOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              className="min-h-11 px-4"
              disabled={deleting}
              onClick={remove}
            >
              {deleting ? 'Menghapus...' : 'Hapus soal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
