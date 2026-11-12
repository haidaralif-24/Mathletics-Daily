import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GapWarnings } from './gap-warning';
import { SoalListSkeleton } from './skeletons';
import { listQuestionItems, loadGapWarnings } from './data';
import {
  formatWibDate,
  questionPhase,
  questionPhaseLabel,
  type QuestionListItem,
} from './payload';

export const metadata: Metadata = {
  title: 'Soal',
  description: 'Kelola soal harian, kunci jawaban, dan mark scheme.',
};

/**
 * `/admin/soal` (Q-1..Q-4): daftar soal terbaru di atas, lengkap dengan status
 * jendela waktu, kelengkapan kunci dan mark scheme, dan jumlah kiriman.
 *
 * Sesi dan data dibaca di dalam <Suspense> karena `cacheComponents` aktif:
 * `cookies()` adalah data yang tidak bisa di-cache, jadi tidak boleh menjadi
 * bagian dari shell yang diprerender.
 */
export default function SoalPage() {
  return (
    <Suspense fallback={<SoalListSkeleton />}>
      <SoalList />
    </Suspense>
  );
}

async function SoalList() {
  const [{ questions, total }, gapWarnings] = await Promise.all([
    listQuestionItems(),
    loadGapWarnings(),
  ]);

  const now = new Date();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Soal</h1>
          <p className="text-sm text-muted-foreground">
            Satu soal per hari. Jendela soal dihitung otomatis dari tanggal rilis.
          </p>
        </div>
        <Link href="/admin/soal/baru" className={cn(buttonVariants(), 'min-h-11 px-4')}>
          <PlusIcon aria-hidden="true" />
          Soal baru
        </Link>
      </div>

      <GapWarnings warnings={gapWarnings} withAction />

      {questions.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-2">
          {questions.map((question) => (
            <li key={question.id}>
              <QuestionRow question={question} now={now} />
            </li>
          ))}
        </ul>
      )}

      {total > questions.length ? (
        <p className="text-xs text-muted-foreground">
          Menampilkan {questions.length} soal terbaru dari total {total} soal.
        </p>
      ) : null}
    </div>
  );
}

function QuestionRow({ question, now }: { question: QuestionListItem; now: Date }) {
  const phase = questionPhase(question, now);

  return (
    <Link
      href={`/admin/soal/${question.id}`}
      className="flex flex-col gap-2 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-heading text-sm font-semibold break-words">{question.title}</span>
        <span className="text-xs text-muted-foreground">
          {formatWibDate(question.releaseDate)}
          {question.topic ? ` · ${question.topic}` : ' · Tanpa topik'}
          {question.difficulty ? ` · Kesulitan ${question.difficulty}/5` : ''}
          {` · ${question.submissionCount} kiriman`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={PHASE_CLASS[phase]}>
          {questionPhaseLabel(question, now)}
        </Badge>
        <Badge variant="outline" className={question.hasKey ? READY_CLASS : MISSING_CLASS}>
          {question.hasKey ? 'Kunci siap' : 'Kunci belum diisi'}
        </Badge>
        <Badge
          variant="outline"
          className={question.hasMarkScheme ? READY_CLASS : MISSING_CLASS}
        >
          {question.hasMarkScheme ? 'Mark scheme siap' : 'Mark scheme belum diisi'}
        </Badge>
      </div>
    </Link>
  );
}

const READY_CLASS = 'border-success/40 text-success';
const MISSING_CLASS = 'border-danger/40 text-danger';
const PHASE_CLASS: Record<'terjadwal' | 'terbuka' | 'ditutup', string> = {
  terjadwal: 'border-border text-muted-foreground',
  terbuka: 'border-success/40 text-success',
  ditutup: 'border-border text-muted-foreground',
};

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-6 text-center">
      <h2 className="font-heading text-base font-semibold">Belum ada soal</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Mulai dengan menambah soal pertama. Soal rilis otomatis pukul 04.00 WIB pada tanggal yang
        kamu pilih dan terbuka selama 24 jam.
      </p>
      <Link href="/admin/soal/baru" className={cn(buttonVariants(), 'min-h-11 px-4')}>
        <PlusIcon aria-hidden="true" />
        Tambah soal pertama
      </Link>
    </div>
  );
}
