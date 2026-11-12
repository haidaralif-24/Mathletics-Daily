'use client';

import { useState } from 'react';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  ImageOffIcon,
  KeyRoundIcon,
  ListChecksIcon,
  RotateCwIcon,
  XCircleIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatWib } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { GradingItem } from './types';
import { GradingItemSkeleton } from './skeletons';
import { PhotoViewer } from './photo-viewer';
import { VERDICT_LABELS, formatGapSeconds } from './utils';

interface SubmissionPanelProps {
  item: GradingItem | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** R-4: while the photo dialog is open the global shortcuts must stay quiet. */
  onPhotoDialogChange?: (open: boolean) => void;
}

/**
 * R-2: the submission on the left — final answer with the auto-verdict, steps
 * (photos with zoom/rotate and typed text), submit time and the gap from release
 * — plus the answer key and the mark scheme, all on the same screen.
 */
export function SubmissionPanel({
  item,
  loading,
  error,
  onRetry,
  onPhotoDialogChange,
}: SubmissionPanelProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  /** R-2: bumped on every open so the viewer remounts with a clean zoom/rotation. */
  const [viewerSession, setViewerSession] = useState(0);

  if (loading && !item) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kiriman anggota</CardTitle>
        </CardHeader>
        <CardContent>
          <GradingItemSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (error && !item) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kiriman anggota</CardTitle>
        </CardHeader>
        <CardContent>
          <div role="alert" className="flex flex-col gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
            <p className="text-danger">{error}</p>
            <Button type="button" variant="outline" className="h-11 self-start" onClick={onRetry}>
              <RotateCwIcon aria-hidden="true" />
              Coba lagi
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!item) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kiriman anggota</CardTitle>
          <CardDescription>
            Pilih satu anggota di daftar sebelah kiri untuk melihat jawaban, langkah pengerjaan,
            kunci jawaban dan mark scheme.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { submission, question, grade } = item;
  const verdict = submission.autoVerdict;
  const stepsEditedAfterSubmit =
    Date.parse(submission.updatedAt) - Date.parse(submission.firstSubmittedAt) > 60_000;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {submission.memberName}
          {submission.className ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">{submission.className}</span>
          ) : null}
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <ClockIcon aria-hidden="true" className="size-3.5" />
            Dikirim {formatWib(new Date(submission.firstSubmittedAt))} WIB
          </span>
          <span>{formatGapSeconds(submission.gapSeconds)}</span>
          {stepsEditedAfterSubmit ? (
            <span>Langkah diperbarui {formatWib(new Date(submission.updatedAt))} WIB</span>
          ) : null}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* R-6: a member who edits steps after grading flags the grade for review. */}
        {grade?.needsRegrade ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
          >
            <AlertTriangleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p>
              Anggota memperbarui langkah pengerjaan setelah dinilai. Periksa lagi lalu simpan ulang
              nilainya.
            </p>
          </div>
        ) : null}

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Jawaban akhir
          </h3>
          <p className="rounded-lg border border-border bg-background p-3 font-mono text-lg break-words whitespace-pre-wrap text-foreground">
            {submission.finalAnswer}
          </p>

          {verdict === null ? (
            <Badge variant="outline" className="w-fit border-border bg-muted text-muted-foreground">
              Pemeriksaan otomatis tidak tersedia
            </Badge>
          ) : verdict === 'needs_review' ? (
            // Never silently treated as wrong: the admin has to decide, and the
            // choice below starts empty.
            <div className="flex items-start gap-2 rounded-lg border-2 border-primary bg-primary/10 p-3 text-sm text-foreground">
              <AlertTriangleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>
                <span className="font-semibold">Perlu ditinjau:</span> jawaban ini tidak bisa
                diperiksa otomatis. Tentukan Benar atau Salah sendiri lewat tombol di sebelah kanan
                (C atau X).
              </p>
            </div>
          ) : (
            <Badge
              variant="outline"
              className={cn(
                'w-fit',
                verdict === 'correct'
                  ? 'border-success/40 bg-success/10 text-success'
                  : 'border-danger/40 bg-danger/10 text-danger',
              )}
            >
              {verdict === 'correct' ? (
                <CheckCircle2Icon aria-hidden="true" />
              ) : (
                <XCircleIcon aria-hidden="true" />
              )}
              Tebakan otomatis: {VERDICT_LABELS[verdict]}
            </Badge>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Langkah pengerjaan
          </h3>

          {submission.photos.length > 0 ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {submission.photos.map((photo, index) => (
                <li key={photo.path}>
                  <button
                    type="button"
                    onClick={() => {
                      setViewerIndex(index);
                      setViewerSession((session) => session + 1);
                      setViewerOpen(true);
                    }}
                    className="flex h-28 w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted outline-none transition-colors hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                    aria-label={`Buka foto langkah pengerjaan ${index + 1} dari ${submission.photos.length}`}
                  >
                    {photo.url ? (
                      // Private bucket, short-lived signature: bypass the image optimiser.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageOffIcon aria-hidden="true" className="size-5 text-muted-foreground" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Tidak ada foto.</p>
          )}

          {submission.stepsText ? (
            <p className="rounded-lg border border-border bg-background p-3 text-sm break-words whitespace-pre-wrap">
              {submission.stepsText}
            </p>
          ) : null}
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
          <div className="flex items-center gap-2">
            <KeyRoundIcon aria-hidden="true" className="size-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Kunci jawaban
            </h3>
          </div>

          {question.answerKey ? (
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-mono text-base break-words">
                {question.answerKey.acceptedAnswers.join('  ·  ') || '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                Tipe: {question.answerKey.answerType}
                {question.answerKey.tolerance !== null && question.answerKey.tolerance > 0
                  ? ` · toleransi ${question.answerKey.tolerance}`
                  : ''}
              </p>
            </div>
          ) : (
            <p className="text-sm text-danger">Kunci jawaban belum diisi untuk soal ini.</p>
          )}

          <div className="flex items-center gap-2">
            <ListChecksIcon aria-hidden="true" className="size-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Mark scheme
            </h3>
          </div>

          {question.markScheme.length > 0 ? (
            <ol className="flex flex-col gap-1 text-sm">
              {question.markScheme.map((item2) => (
                <li key={item2.position} className="flex items-start justify-between gap-3">
                  <span className="break-words">
                    <span className="mr-1 text-muted-foreground">{item2.position}.</span>
                    {item2.descriptionMd}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{item2.points} poin</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-danger">Mark scheme belum diisi untuk soal ini.</p>
          )}
        </section>
      </CardContent>

      <PhotoViewer
        key={viewerSession}
        photos={submission.photos}
        startIndex={viewerIndex}
        open={viewerOpen}
        onOpenChange={(open) => {
          setViewerOpen(open);
          onPhotoDialogChange?.(open);
        }}
      />
    </Card>
  );
}
