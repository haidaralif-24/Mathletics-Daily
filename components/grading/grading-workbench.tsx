'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangleIcon, InfoIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { loadGradingItem, loadGradingRoster, saveGrade } from '@/lib/actions/grading';
import { computeGrade } from '@/lib/scoring';
import type {
  GradingItem,
  GradingQuestionOption,
  GradingRoster,
  RosterFilter,
  RosterSort,
} from './types';
import { GradeForm } from './grade-form';
import { RosterPanel } from './roster-panel';
import { SubmissionPanel } from './submission-panel';
import { applyGradeToRoster, nextUngradedRow, prefilledCorrect } from './utils';

/** R-4: the keys the screen listens for, shown as hints next to the buttons. */
const SHORTCUTS = [
  { keys: 'C', label: 'Benar' },
  { keys: 'X', label: 'Salah' },
  { keys: 'Enter', label: 'Simpan & lanjut' },
];

interface GradingWorkbenchProps {
  questions: GradingQuestionOption[];
  initialQuestionId: string | null;
  /** R-1: fetched on the server so the first paint already shows the roster. */
  initialRoster: GradingRoster | null;
  initialRosterError: string | null;
}

/**
 * R-4: one screen, no page changes. Picking a question, walking the roster,
 * reading the key and the mark scheme, grading and jumping to the next ungraded
 * submission all happen here, so a whole question can be graded without a
 * navigation. Data is loaded in the handlers that trigger it (not in effects), so
 * there is no double fetch and no cascading render.
 */
export function GradingWorkbench({
  questions,
  initialQuestionId,
  initialRoster,
  initialRosterError,
}: GradingWorkbenchProps) {
  const [questionId, setQuestionId] = useState<string | null>(initialQuestionId);
  const [roster, setRoster] = useState<GradingRoster | null>(initialRoster);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(initialRosterError);
  const [filter, setFilter] = useState<RosterFilter>('all');
  const [sort, setSort] = useState<RosterSort>('submit_asc');

  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [item, setItem] = useState<GradingItem | null>(null);
  const [itemLoading, setItemLoading] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [ticks, setTicks] = useState<number[]>([]);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);

  /** Ignores a slow response for a submission the admin has already left. */
  const itemRequestRef = useRef(0);

  const selectedQuestion = questions.find((question) => question.id === questionId) ?? null;

  /* ---------------------------------------------------------------- roster (R-1) */

  const loadRoster = useCallback(async (id: string) => {
    setRosterLoading(true);
    const result = await loadGradingRoster(id);
    setRosterLoading(false);

    if (!result.ok) {
      setRoster(null);
      setRosterError(result.error.message);
      return;
    }

    setRosterError(null);
    setRoster(result.data);
  }, []);

  const changeQuestion = (id: string) => {
    setQuestionId(id);
    setRoster(null);
    setRosterError(null);
    setSelectedSubmissionId(null);
    setItem(null);
    setItemError(null);
    setIsCorrect(null);
    setTicks([]);
    setFeedback('');
    setSaveError(null);
    void loadRoster(id);
  };

  /* ------------------------------------------------------------------- item (R-2) */

  const openSubmission = useCallback(async (submissionId: string) => {
    const token = itemRequestRef.current + 1;
    itemRequestRef.current = token;

    setSelectedSubmissionId(submissionId);
    setItemLoading(true);
    setItemError(null);

    const result = await loadGradingItem(submissionId);
    if (token !== itemRequestRef.current) return;

    setItemLoading(false);

    if (!result.ok) {
      setItem(null);
      setItemError(result.error.message);
      return;
    }

    setItem(result.data);
    setSaveError(null);

    // R-5 / R-7: a saved grade wins over the auto-verdict. R-2: a new grade starts
    // from the auto-verdict, except `needs_review`, which stays undecided.
    if (result.data.grade) {
      setIsCorrect(result.data.grade.isCorrect);
      setTicks(result.data.grade.criteriaTicks);
      setFeedback(result.data.grade.privateFeedback ?? '');
    } else {
      setIsCorrect(prefilledCorrect(result.data.submission.autoVerdict));
      setTicks([]);
      setFeedback('');
    }
  }, []);

  /* ------------------------------------------------------------------- total (R-3) */

  // The ticked criteria are the steps input; the breakdown itself comes from
  // lib/scoring.ts, exactly like the save action does on the server (hard rule 4).
  const stepsPoints = useMemo(() => {
    if (!item) return 0;
    return item.question.markScheme
      .filter((criterion) => ticks.includes(criterion.position))
      .reduce((sum, criterion) => sum + criterion.points, 0);
  }, [item, ticks]);

  const preview = useMemo(() => {
    if (!item || isCorrect === null) return null;
    return computeGrade({
      isCorrect,
      stepsPoints,
      firstSubmittedAt: new Date(item.submission.firstSubmittedAt),
      releaseAt: new Date(item.question.releaseAt),
    });
  }, [item, isCorrect, stepsPoints]);

  /* ------------------------------------------------------------- saving (R-3, R-4) */

  const handleSave = async (jumpToNext: boolean) => {
    if (!item || saving) return;

    if (isCorrect === null) {
      const message = 'Pilih Benar atau Salah dulu.';
      setSaveError(message);
      toast.error(message);
      return;
    }

    setSaving(true);
    setSaveError(null);

    const result = await saveGrade({
      submissionId: item.submission.id,
      isCorrect,
      criteriaTicks: ticks,
      privateFeedback: feedback.trim().length > 0 ? feedback.trim() : undefined,
    });

    setSaving(false);

    if (!result.ok) {
      setSaveError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    const saved = result.data;
    setItem((current) => (current ? { ...current, grade: saved } : current));

    // R-5: fold the saved grade (and its author) straight back into the roster.
    const updatedRows = applyGradeToRoster(roster?.rows ?? [], item.submission.id, saved);
    setRoster((current) => (current ? { ...current, rows: updatedRows } : current));

    if (!jumpToNext) {
      toast.success('Nilai tersimpan.');
      return;
    }

    const withinFilter = nextUngradedRow(updatedRows, filter, sort);
    // A filter that hides the ungraded rows must not stop the walk (R-4).
    const next =
      withinFilter ?? (filter === 'all' ? null : nextUngradedRow(updatedRows, 'all', sort));

    if (next?.submissionId) {
      if (!withinFilter) setFilter('all');
      toast.success(`Nilai tersimpan. Lanjut ke ${next.displayName}.`);
      void openSubmission(next.submissionId);
    } else {
      toast.success('Nilai tersimpan. Semua kiriman sudah dinilai.');
    }
  };

  const toggleTick = (position: number) => {
    setTicks((current) =>
      current.includes(position)
        ? current.filter((value) => value !== position)
        : [...current, position].sort((a, b) => a - b),
    );
  };

  /* ----------------------------------------------------------------- shortcuts (R-4) */

  // The listener is registered once and reads the latest handler through a ref, so
  // it always sees current state without re-subscribing on every keystroke.
  const keyHandlerRef = useRef<(event: KeyboardEvent) => void>(() => {});

  const handleShortcut = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    // Never fire while the admin is typing — the feedback textarea especially.
    if (isTypingTarget(event.target)) return;
    // Let the browser handle Enter/Space on a focused button or link.
    if (event.target instanceof HTMLElement && event.target.closest('button, a, [role="button"]')) {
      return;
    }
    if (photoDialogOpen) return;

    const key = event.key.toLowerCase();
    if (key === 'c') {
      event.preventDefault();
      setIsCorrect(true);
      return;
    }
    if (key === 'x') {
      event.preventDefault();
      setIsCorrect(false);
      return;
    }
    if (event.key === 'Enter' && item) {
      event.preventDefault();
      void handleSave(true);
    }
  };

  useEffect(() => {
    keyHandlerRef.current = handleShortcut;
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandlerRef.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const selectedRow = roster?.rows.find((row) => row.submissionId === selectedSubmissionId) ?? null;
  const waitingCount = roster?.rows.filter((row) => row.status === 'ungraded').length ?? 0;

  if (questions.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <h2 className="font-heading text-lg font-semibold">Belum ada soal untuk dinilai</h2>
        <p className="text-sm text-muted-foreground">
          Buat soal beserta kunci jawaban dan mark scheme-nya dulu, lalu kembali ke halaman ini.
        </p>
        <Button className="mt-2 h-11 self-start" nativeButton={false} render={<Link href="/admin/soal" />}>
          Buka halaman Soal
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">Koreksi</h1>
          <p className="text-sm text-muted-foreground">
            {waitingCount > 0
              ? `${waitingCount} kiriman menunggu dinilai.`
              : 'Semua kiriman pada soal ini sudah dinilai.'}
          </p>
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="sr-only">Pintasan papan ketik:</span>
          {SHORTCUTS.map((shortcut) => (
            <span key={shortcut.keys} className="inline-flex items-center gap-1">
              <kbd
                aria-hidden="true"
                className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] font-medium"
              >
                {shortcut.keys}
              </kbd>
              {shortcut.label}
            </span>
          ))}
        </p>
      </header>

      {selectedQuestion?.phase === 'open' ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground"
        >
          <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Soal ini masih berjalan. Nilai yang kamu simpan sekarang bisa berubah jika anggota
            memperbarui langkah pengerjaannya sebelum soal ditutup.
          </span>
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(15rem,18rem)_1fr]">
        <RosterPanel
          questions={questions}
          questionId={questionId}
          onQuestionChange={changeQuestion}
          roster={roster}
          loading={rosterLoading}
          error={rosterError}
          onRetry={() => {
            if (questionId) void loadRoster(questionId);
          }}
          filter={filter}
          sort={sort}
          onFilterChange={setFilter}
          onSortChange={setSort}
          selectedSubmissionId={selectedSubmissionId}
          onSelect={(submissionId) => void openSubmission(submissionId)}
        />

        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          {selectedRow?.needsRegrade ? (
            <p
              role="status"
              className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger xl:col-span-2"
            >
              <AlertTriangleIcon aria-hidden="true" className="size-4 shrink-0" />
              Kiriman ini diedit setelah dinilai, jadi perlu ditinjau lagi.
            </p>
          ) : null}

          {item && item.submission.questionId === questionId ? (
            <>
              <SubmissionPanel
                item={item}
                loading={itemLoading}
                error={itemError}
                onRetry={() => {
                  if (selectedSubmissionId) void openSubmission(selectedSubmissionId);
                }}
                onPhotoDialogChange={setPhotoDialogOpen}
              />
              <GradeForm
                item={item}
                isCorrect={isCorrect}
                onSetCorrect={setIsCorrect}
                ticks={ticks}
                onToggleTick={toggleTick}
                feedback={feedback}
                onFeedbackChange={setFeedback}
                stepsPoints={stepsPoints}
                preview={preview}
                saving={saving}
                error={saveError}
                onSave={() => void handleSave(false)}
              />
            </>
          ) : (
            <>
              <SubmissionPanel
                item={null}
                loading={itemLoading}
                error={itemError}
                onRetry={() => {
                  if (selectedSubmissionId) void openSubmission(selectedSubmissionId);
                }}
              />
              <div className="rounded-xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-foreground/10">
                Pilih kiriman di daftar untuk mulai menilai.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** R-4: `C`/`X`/`Enter` must never fire while the admin is typing. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
