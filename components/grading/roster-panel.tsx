'use client';

import { AlertTriangleIcon, RotateCwIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  GradingQuestionOption,
  GradingRoster,
  RosterFilter,
  RosterRow,
  RosterSort,
} from './types';
import { RosterSkeleton } from './skeletons';
import {
  FILTER_LABELS,
  SORT_LABELS,
  STATUS_LABELS,
  filterRoster,
  progressLabel,
  questionOptionLabel,
  rosterCounts,
  sortRoster,
} from './utils';

const FILTER_OPTIONS = (Object.keys(FILTER_LABELS) as RosterFilter[]).map((value) => ({
  value,
  label: FILTER_LABELS[value],
}));

const SORT_OPTIONS = (Object.keys(SORT_LABELS) as RosterSort[]).map((value) => ({
  value,
  label: SORT_LABELS[value],
}));

const STATUS_BADGE_CLASS: Record<RosterRow['status'], string> = {
  graded: 'border-success/40 bg-success/10 text-success',
  ungraded: 'border-primary/40 bg-primary/10 text-primary',
  not_submitted: 'border-border bg-muted text-muted-foreground',
};

const QUESTION_PHASE_LABEL: Record<GradingQuestionOption['phase'], string> = {
  open: 'sedang berjalan',
  released: 'sudah ditutup',
  upcoming: 'belum rilis',
};

interface RosterPanelProps {
  questions: GradingQuestionOption[];
  questionId: string | null;
  onQuestionChange: (questionId: string) => void;
  roster: GradingRoster | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  filter: RosterFilter;
  sort: RosterSort;
  onFilterChange: (filter: RosterFilter) => void;
  onSortChange: (sort: RosterSort) => void;
  selectedSubmissionId: string | null;
  onSelect: (submissionId: string) => void;
}

/**
 * R-1: pick a question, then every active member as Belum kirim / Belum dinilai /
 * Sudah dinilai, with a filter, a sort by submit time and the progress count.
 * Filtering and sorting happen on the client so picking the next submission stays
 * instant (R-4).
 */
export function RosterPanel({
  questions,
  questionId,
  onQuestionChange,
  roster,
  loading,
  error,
  onRetry,
  filter,
  sort,
  onFilterChange,
  onSortChange,
  selectedSubmissionId,
  onSelect,
}: RosterPanelProps) {
  const rows = roster?.rows ?? [];
  const counts = rosterCounts(rows);
  const visible = sortRoster(filterRoster(rows, filter), sort);

  return (
    <Card className="lg:sticky lg:top-28 lg:max-h-[calc(100dvh-8rem)]">
      <CardHeader>
        <CardTitle>Daftar kiriman</CardTitle>
        {/* R-4: this string is the progress, exactly as the spec writes it. */}
        <p className="font-heading text-lg font-semibold text-foreground" aria-live="polite">
          {loading && !roster ? 'Memuat...' : progressLabel(counts)}
        </p>
        <p className="text-xs text-muted-foreground">
          {counts.members} anggota aktif · {counts.notSubmitted} belum kirim
        </p>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span id="koreksi-soal-label" className="text-xs font-medium text-muted-foreground">
            Soal
          </span>
          <Select
            items={questions.map((question) => ({
              value: question.id,
              label: questionOptionLabel(question),
            }))}
            value={questionId}
            onValueChange={(value) => {
              if (typeof value === 'string') onQuestionChange(value);
            }}
          >
            <SelectTrigger className="min-h-11 w-full" aria-labelledby="koreksi-soal-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {questions.map((question) => (
                <SelectItem key={question.id} value={question.id}>
                  {`${questionOptionLabel(question)} (${QUESTION_PHASE_LABEL[question.phase]})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span id="koreksi-filter-label" className="text-xs font-medium text-muted-foreground">
              Tampilkan
            </span>
            <Select
              items={FILTER_OPTIONS}
              value={filter}
              onValueChange={(value) => {
                if (typeof value === 'string') onFilterChange(value as RosterFilter);
              }}
            >
              <SelectTrigger className="min-h-11 w-full" aria-labelledby="koreksi-filter-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span id="koreksi-sort-label" className="text-xs font-medium text-muted-foreground">
              Urutkan
            </span>
            <Select
              items={SORT_OPTIONS}
              value={sort}
              onValueChange={(value) => {
                if (typeof value === 'string') onSortChange(value as RosterSort);
              }}
            >
              <SelectTrigger className="min-h-11 w-full" aria-labelledby="koreksi-sort-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm"
          >
            <p className="text-danger">{error}</p>
            <Button type="button" variant="outline" className="h-11 self-start" onClick={onRetry}>
              <RotateCwIcon aria-hidden="true" />
              Coba lagi
            </Button>
          </div>
        ) : null}

        {loading && !roster ? <RosterSkeleton /> : null}

        {!loading || roster ? (
          visible.length === 0 ? (
            <div className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
              <p>Tidak ada anggota yang cocok dengan filter ini.</p>
              {filter !== 'all' ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-1 h-11 px-2"
                  onClick={() => onFilterChange('all')}
                >
                  Tampilkan semua
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Menampilkan {visible.length} dari {rows.length} anggota
              </p>
              <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="Anggota">
                {visible.map((row) => {
                  const selected = row.submissionId !== null && row.submissionId === selectedSubmissionId;
                  return (
                    <li key={row.memberId}>
                      <button
                        type="button"
                        disabled={row.submissionId === null}
                        aria-current={selected ? 'true' : undefined}
                        onClick={() => {
                          if (row.submissionId) onSelect(row.submissionId);
                        }}
                        className={cn(
                          'flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-transparent px-3 py-2 text-left outline-none transition-colors',
                          'focus-visible:ring-3 focus-visible:ring-ring/50',
                          row.submissionId === null
                            ? 'cursor-not-allowed opacity-60'
                            : 'hover:bg-muted',
                          selected && 'bg-accent ring-2 ring-primary',
                        )}
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">{row.displayName}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {row.className ?? 'Tanpa kelas'}
                            {row.totalPoints !== null ? ` · ${row.totalPoints} poin` : ''}
                          </span>
                          {row.needsRegrade ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-danger">
                              <AlertTriangleIcon aria-hidden="true" className="size-3.5" />
                              Perlu dinilai ulang
                            </span>
                          ) : null}
                        </span>
                        <Badge variant="outline" className={cn('shrink-0', STATUS_BADGE_CLASS[row.status])}>
                          {STATUS_LABELS[row.status]}
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
