'use client';

import { CheckCircle2Icon, Loader2Icon, XCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import type { GradeResult } from '@/lib/scoring';
import { formatWib } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { GradingItem } from './types';

const FEEDBACK_MAX = 2000;

interface GradeFormProps {
  item: GradingItem;
  isCorrect: boolean | null;
  onSetCorrect: (value: boolean) => void;
  ticks: number[];
  onToggleTick: (position: number) => void;
  feedback: string;
  onFeedbackChange: (value: string) => void;
  /** Sum of the ticked mark-scheme criteria — the steps input of the formula. */
  stepsPoints: number;
  /** R-3: the total the admin sees before saving. Always from `computeGrade`. */
  preview: GradeResult | null;
  saving: boolean;
  error: string | null;
  onSave: () => void;
}

/**
 * R-3 / R-4: confirm or override the verdict, tick the mark-scheme criteria and
 * write private feedback, with the total visible before saving. R-5 and R-7: an
 * existing grade is shown and can be rewritten.
 */
export function GradeForm({
  item,
  isCorrect,
  onSetCorrect,
  ticks,
  onToggleTick,
  feedback,
  onFeedbackChange,
  stepsPoints,
  preview,
  saving,
  error,
  onSave,
}: GradeFormProps) {
  const { grade, question } = item;
  const regrade = grade !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Penilaian</CardTitle>
        {/* R-5: last write wins, and the screen says who wrote it. */}
        {grade ? (
          <CardDescription>
            Terakhir dinilai oleh {grade.gradedByName ?? 'admin lain'} ·{' '}
            {formatWib(new Date(grade.gradedAt))} WIB. Menyimpan ulang memperbarui poin dan waktu
            penilaiannya (R-7).
          </CardDescription>
        ) : (
          <CardDescription>Belum dinilai.</CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span id="koreksi-verdict-label" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Jawaban akhir
          </span>
          <div role="group" aria-labelledby="koreksi-verdict-label" className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              aria-pressed={isCorrect === true}
              onClick={() => onSetCorrect(true)}
              className={cn(
                'h-11 justify-center gap-2',
                isCorrect === true &&
                  'border-success bg-success text-success-foreground hover:bg-success/90',
              )}
            >
              <CheckCircle2Icon aria-hidden="true" />
              Benar
              <ShortcutKey>C</ShortcutKey>
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-pressed={isCorrect === false}
              onClick={() => onSetCorrect(false)}
              className={cn(
                'h-11 justify-center gap-2',
                isCorrect === false &&
                  'border-danger bg-danger text-danger-foreground hover:bg-danger/90',
              )}
            >
              <XCircleIcon aria-hidden="true" />
              Salah
              <ShortcutKey>X</ShortcutKey>
            </Button>
          </div>
          {isCorrect === null ? (
            <p className="text-xs text-danger" role="status">
              Pilih Benar atau Salah dulu sebelum menyimpan.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Mark scheme · {stepsPoints} poin langkah
          </span>
          {question.markScheme.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {question.markScheme.map((criterion) => {
                const ticked = ticks.includes(criterion.position);
                return (
                  <li key={criterion.position}>
                    <label className="flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border border-border bg-background p-2.5 text-sm hover:bg-muted">
                      <Checkbox
                        checked={ticked}
                        onCheckedChange={() => onToggleTick(criterion.position)}
                        className="mt-0.5"
                      />
                      <span className="flex-1 break-words">
                        <span className="mr-1 text-muted-foreground">{criterion.position}.</span>
                        {criterion.descriptionMd}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {criterion.points} poin
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-danger">Soal ini belum punya mark scheme.</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="koreksi-feedback" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Catatan untuk anggota (opsional)
          </label>
          <Textarea
            id="koreksi-feedback"
            value={feedback}
            onChange={(event) => onFeedbackChange(event.target.value)}
            maxLength={FEEDBACK_MAX}
            rows={3}
            placeholder="Hanya anggota ini yang bisa membaca catatan ini."
            aria-describedby="koreksi-feedback-help"
          />
          <p id="koreksi-feedback-help" className="text-xs text-muted-foreground">
            {feedback.length}/{FEEDBACK_MAX} karakter · anggota melihatnya setelah soal ditutup.
          </p>
        </div>

        {/* R-3: the total is visible before saving. */}
        <div
          className="flex flex-col gap-1 rounded-lg border border-border bg-background p-3"
          aria-live="polite"
        >
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Total sebelum disimpan
          </span>
          {preview ? (
            <>
              <p className="font-heading text-2xl font-semibold text-foreground">{preview.total} poin</p>
              <p className="text-xs text-muted-foreground">
                Benar {preview.base} · Kecepatan {preview.speed} · Langkah {preview.steps}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pilih Benar atau Salah untuk melihat totalnya.
            </p>
          )}
        </div>

        {error ? (
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button type="button" className="h-11 w-full" onClick={onSave} disabled={saving}>
            {saving ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : null}
            {saving ? 'Menyimpan...' : regrade ? 'Simpan ulang' : 'Simpan'}
          </Button>
          {/* R-4: the shortcuts are visible, not hidden. */}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ShortcutKey>C</ShortcutKey> Benar
            </span>
            <span className="inline-flex items-center gap-1">
              <ShortcutKey>X</ShortcutKey> Salah
            </span>
            <span className="inline-flex items-center gap-1">
              <ShortcutKey>Enter</ShortcutKey> Simpan &amp; lanjut ke yang belum dinilai
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ShortcutKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}
