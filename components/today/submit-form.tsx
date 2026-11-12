'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import {
  Camera,
  ImagePlus,
  Info,
  LoaderCircle,
  Lock,
  Send,
  Trash,
  TriangleAlert,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { submitAnswer } from '@/lib/actions/submit';
import { LIMITS } from '@/lib/config';
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
import { Textarea } from '@/components/ui/textarea';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

/**
 * M-1..M-8: the member's submit flow.
 *
 * Order matters (M-5): every photo is compressed on the device and uploaded
 * first; the `submitAnswer` action runs only once all of them are in place. If
 * an upload fails nothing is sent, the form stays usable and the member can
 * retry — a stray object in the bucket is harmless, a half-saved submission is
 * not.
 */

/** docs/UI_GUIDE.md, verbatim — shown before the first submit only (M-3). */
const CONFIRM_TEXT = 'Jawaban akhir tidak bisa diubah setelah dikirim. Lanjutkan?';
/** docs/UI_GUIDE.md, verbatim. */
const UPLOAD_FAILED = 'Foto gagal diunggah. Coba lagi.';
const SUCCESS_TEXT = 'Jawaban terkirim';

const FIELD_WITH_ERROR = 'border-destructive aria-invalid:ring-destructive/20';
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_MB = Math.round(LIMITS.stepPhotoMaxBytes / (1024 * 1024));

/** M-2, roughly: about 1600 px and about 250 KB, done on the phone. */
const COMPRESSION = {
  maxWidthOrHeight: 1600,
  maxSizeMB: 0.25,
  initialQuality: 0.8,
  fileType: 'image/jpeg',
  useWebWorker: true,
} as const;

type PhotoStatus = 'menyiapkan' | 'mengunggah' | 'siap';

interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
  status: PhotoStatus;
  /** Compression only: the storage SDK reports no upload progress. */
  progress: number;
  /** Filled in once the object is in the bucket. */
  path: string | null;
}

export interface ExistingPhoto {
  path: string;
  url: string | null;
}

export interface SubmitFormProps {
  questionId: string;
  userId: string;
  initial: {
    finalAnswer: string;
    stepsText: string;
    photos: ExistingPhoto[];
    /** Non-null once the final answer is locked (M-3). */
    firstSubmittedAtIso: string | null;
  };
}

export function SubmitForm({ questionId, userId, initial }: SubmitFormProps) {
  const router = useRouter();

  const [finalAnswer, setFinalAnswer] = useState(initial.finalAnswer);
  const [stepsText, setStepsText] = useState(initial.stepsText);
  const [keptPhotos, setKeptPhotos] = useState<ExistingPhoto[]>(initial.photos);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [locked, setLocked] = useState(initial.firstSubmittedAtIso !== null);
  const [baseline, setBaseline] = useState(() => ({
    finalAnswer: initial.finalAnswer.trim(),
    stepsText: initial.stepsText.trim(),
    photoPaths: initial.photos.map((photo) => photo.path).join('|'),
  }));

  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [stepsError, setStepsError] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);

  useEffect(
    () => () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  const busy = photos.some((photo) => photo.status !== 'siap');
  const allPaths = [
    ...keptPhotos.map((photo) => photo.path),
    ...photos.map((photo) => photo.path ?? ''),
  ];
  const dirty =
    finalAnswer.trim() !== baseline.finalAnswer ||
    stepsText.trim() !== baseline.stepsText ||
    allPaths.join('|') !== baseline.photoPaths;

  // M-8: warn before leaving with unsaved work.
  useEffect(() => {
    if (!dirty || submitting) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, submitting]);

  function updatePhoto(id: string, patch: Partial<PendingPhoto>) {
    setPhotos((current) => current.map((photo) => (photo.id === id ? { ...photo, ...patch } : photo)));
  }

  async function addPhotos(list: FileList | null) {
    if (!list || list.length === 0) return;

    const room = LIMITS.stepPhotosMax - (keptPhotos.length + photos.length);
    if (room <= 0) {
      toast.error(`Maksimal ${LIMITS.stepPhotosMax} foto.`);
      return;
    }

    setError(null);

    for (const file of Array.from(list).slice(0, room)) {
      if (!ACCEPTED_MIME.includes(file.type)) {
        setError('Format foto harus JPG, PNG, atau WebP.');
        continue;
      }
      if (file.size > LIMITS.stepPhotoMaxBytes) {
        setError(`Ukuran foto maksimal ${MAX_PHOTO_MB} MB.`);
        continue;
      }

      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      objectUrls.current.push(previewUrl);
      setPhotos((current) => [
        ...current,
        { id, file, previewUrl, status: 'menyiapkan', progress: 0, path: null },
      ]);

      try {
        const compressed = await imageCompression(file, {
          ...COMPRESSION,
          onProgress: (value) => updatePhoto(id, { progress: Math.min(95, Math.round(value)) }),
        });
        updatePhoto(id, { file: compressed, status: 'siap', progress: 100 });
      } catch {
        // A photo that cannot be prepared is dropped instead of blocking the form.
        setPhotos((current) => current.filter((photo) => photo.id !== id));
        setError('Foto tidak bisa diproses. Coba foto lain.');
      }
    }
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((photo) => photo.id !== id);
    });
  }

  async function send() {
    setSubmitting(true);
    setError(null);
    setAnswerError(null);
    setStepsError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const paths: string[] = keptPhotos.map((photo) => photo.path);
      const nextKept: ExistingPhoto[] = [...keptPhotos];

      // 1. Upload everything first, and only then write to the database (M-5).
      for (const photo of photos) {
        if (photo.path) {
          paths.push(photo.path);
          nextKept.push({ path: photo.path, url: photo.previewUrl });
          continue;
        }

        updatePhoto(photo.id, { status: 'mengunggah' });

        // `{user_id}/{question_id}/{uuid}` — the bucket policy and the RPC both
        // reject a path outside the caller's own folder.
        const path = `${userId}/${questionId}/${crypto.randomUUID()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('submission-media')
          .upload(path, photo.file, { contentType: 'image/jpeg', cacheControl: '3600' });

        if (uploadError) {
          updatePhoto(photo.id, { status: 'siap' });
          setError(UPLOAD_FAILED);
          toast.error(UPLOAD_FAILED);
          // Nothing is written: the member fixes the photo and tries again.
          return;
        }

        paths.push(path);
        nextKept.push({ path, url: photo.previewUrl });
        updatePhoto(photo.id, { path, status: 'siap' });
      }

      // 2. One call, one server-side write.
      const result = await submitAnswer({
        questionId,
        finalAnswer: finalAnswer.trim(),
        steps: { stepsText: stepsText.trim(), photoPaths: paths },
      });

      if (!result.ok) {
        setError(result.error.message);
        setAnswerError(result.error.fieldErrors?.finalAnswer?.[0] ?? null);
        setStepsError(result.error.fieldErrors?.steps?.[0] ?? null);
        toast.error(result.error.message);
        return;
      }

      toast.success(SUCCESS_TEXT);

      // The answer is locked from here on (M-3); keep this screen in step with
      // the server without waiting for the refresh to land.
      setLocked(true);
      setKeptPhotos(nextKept);
      setPhotos([]);
      setBaseline({
        finalAnswer: finalAnswer.trim(),
        stepsText: stepsText.trim(),
        photoPaths: paths.join('|'),
      });
      router.refresh();
    } catch {
      // Offline, storage quota, anything unexpected: leave the form as it is.
      setError(UPLOAD_FAILED);
      toast.error(UPLOAD_FAILED);
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || busy) return;

    // M-3: the confirmation is for the first submit only; later submits just
    // replace the steps, so they go straight through.
    if (locked) {
      void send();
      return;
    }

    setConfirmOpen(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jawabanmu</CardTitle>
        <CardDescription>
          {locked
            ? 'Jawaban akhirmu sudah terkunci. Langkah pengerjaan masih bisa diperbarui sampai soal ditutup.'
            : 'Tulis jawaban akhir, lalu lampirkan foto langkah pengerjaan.'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
          {/* M-1: final answer, required, up to 500 characters. */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="jawaban-akhir">Jawaban akhir</Label>
            <Input
              id="jawaban-akhir"
              name="finalAnswer"
              value={finalAnswer}
              onChange={(event) => setFinalAnswer(event.target.value)}
              maxLength={LIMITS.finalAnswerMaxChars}
              readOnly={locked}
              required
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Contoh: 3/4"
              aria-invalid={answerError ? true : undefined}
              aria-describedby="bantuan-jawaban-akhir"
              className={cn('h-11 text-base', answerError && FIELD_WITH_ERROR, locked && 'bg-muted')}
            />
            {locked ? (
              <p
                id="bantuan-jawaban-akhir"
                className="flex items-start gap-1.5 text-xs text-muted-foreground"
              >
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                Jawaban akhir tidak bisa diubah setelah dikirim.
              </p>
            ) : (
              <p id="bantuan-jawaban-akhir" className="text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {finalAnswer.trim().length}/{LIMITS.finalAnswerMaxChars}
                </span>{' '}
                karakter · teks biasa, misalnya 3/4 atau sqrt(2)
              </p>
            )}
            {answerError ? (
              <p role="alert" className="text-sm text-destructive">
                {answerError}
              </p>
            ) : null}
          </div>

          {/* M-2: at least one photo or some typed text. */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="langkah-teks">Langkah pengerjaan</Label>
            <p className="text-xs text-muted-foreground">
              Lampirkan minimal satu foto atau tulis langkah pengerjaanmu.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 px-3"
                onClick={() => cameraInput.current?.click()}
                disabled={submitting}
              >
                <Camera aria-hidden="true" />
                Kamera
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 px-3"
                onClick={() => fileInput.current?.click()}
                disabled={submitting}
              >
                <ImagePlus aria-hidden="true" />
                Unggah foto
              </Button>
              <span className="text-xs text-muted-foreground">
                Maksimal {LIMITS.stepPhotosMax} foto · {MAX_PHOTO_MB} MB per foto
              </span>
            </div>

            <input
              ref={cameraInput}
              type="file"
              accept={ACCEPTED_MIME.join(',')}
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                void addPhotos(event.target.files);
                event.target.value = '';
              }}
            />
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED_MIME.join(',')}
              multiple
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                void addPhotos(event.target.files);
                event.target.value = '';
              }}
            />

            {keptPhotos.length + photos.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {keptPhotos.map((photo) => (
                  <li key={photo.path} className="flex flex-col gap-1">
                    <div className="relative overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
                      {photo.url ? (
                        <Image
                          src={photo.url}
                          alt="Foto langkah pengerjaan yang sudah dikirim"
                          width={400}
                          height={400}
                          unoptimized
                          className="aspect-square w-full object-cover"
                        />
                      ) : (
                        <div className="grid aspect-square w-full place-items-center px-2 text-center text-xs text-muted-foreground">
                          Foto tersimpan
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon-sm"
                        className="absolute top-1 right-1 bg-background/90"
                        onClick={() =>
                          setKeptPhotos((current) => current.filter((item) => item.path !== photo.path))
                        }
                        disabled={submitting}
                        aria-label="Hapus foto ini"
                      >
                        <X aria-hidden="true" />
                      </Button>
                    </div>
                    <span className="text-xs text-muted-foreground">Sudah diunggah</span>
                  </li>
                ))}

                {photos.map((photo) => (
                  <li key={photo.id} className="flex flex-col gap-1">
                    <div className="relative overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
                      <Image
                        src={photo.previewUrl}
                        alt="Pratinjau foto langkah pengerjaan"
                        width={400}
                        height={400}
                        unoptimized
                        className="aspect-square w-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon-sm"
                        className="absolute top-1 right-1 bg-background/90"
                        onClick={() => removePhoto(photo.id)}
                        disabled={submitting}
                        aria-label="Hapus foto ini"
                      >
                        <Trash aria-hidden="true" />
                      </Button>
                      {photo.status === 'menyiapkan' ? (
                        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-background/70">
                          <span
                            className="block h-full bg-primary transition-[width] duration-200"
                            style={{ width: `${photo.progress}%` }}
                          />
                        </span>
                      ) : null}
                    </div>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {photo.status === 'menyiapkan' ? (
                        <>
                          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                          Menyiapkan{photo.progress > 0 ? ` ${photo.progress}%` : '…'}
                        </>
                      ) : photo.status === 'mengunggah' ? (
                        <>
                          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                          Mengunggah…
                        </>
                      ) : photo.path ? (
                        <>Sudah diunggah</>
                      ) : (
                        <>Siap dikirim</>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            <Textarea
              id="langkah-teks"
              name="stepsText"
              value={stepsText}
              onChange={(event) => setStepsText(event.target.value)}
              rows={4}
              placeholder="Tulis langkah pengerjaanmu di sini (opsional kalau sudah ada foto)."
              className={cn('text-base', stepsError && FIELD_WITH_ERROR)}
              aria-invalid={stepsError ? true : undefined}
              aria-describedby={stepsError ? 'langkah-teks-error' : undefined}
            />
            {stepsError ? (
              <p id="langkah-teks-error" role="alert" className="text-sm text-destructive">
                {stepsError}
              </p>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="submit"
              size="lg"
              className="h-11 px-4"
              disabled={submitting || busy}
              aria-busy={submitting}
            >
              {submitting ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Send aria-hidden="true" />
              )}
              {submitting ? 'Mengirim...' : locked ? 'Simpan langkah' : 'Kirim'}
            </Button>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="size-3.5 shrink-0" aria-hidden="true" />
              {locked
                ? 'Poin muncul setelah soal ditutup dan dinilai admin.'
                : 'Periksa dulu sebelum mengirim; jawaban akhir terkunci setelah terkirim.'}
            </p>
          </div>
        </form>
      </CardContent>

      {/* M-3: confirmation before the first submit, with the exact copy. */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kirim jawaban sekarang?</DialogTitle>
            <DialogDescription>{CONFIRM_TEXT}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 px-4"
              onClick={() => setConfirmOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              className="h-11 px-4"
              onClick={() => {
                setConfirmOpen(false);
                void send();
              }}
            >
              Ya, kirim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
