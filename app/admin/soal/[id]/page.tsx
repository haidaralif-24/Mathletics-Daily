import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { requireAdmin } from '@/lib/auth';
import { EditorSkeleton } from '../skeletons';
import {
  formatReleaseWindow,
  questionPhase,
  questionPhaseLabel,
  toQuestionFormValues,
} from '../payload';
import { QuestionForm } from '../question-form';
import { getQuestionForEdit } from '../data';

export const metadata: Metadata = {
  title: 'Edit soal',
  description: 'Ubah soal, kunci jawaban, dan mark scheme.',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Q-1..Q-4: editor soal yang sudah ada. Soal dengan kiriman hanya bisa diedit
 * (tombol hapus dinonaktifkan, lengkap dengan alasannya).
 */
export default function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditQuestionScreen params={params} />
    </Suspense>
  );
}

async function EditQuestionScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  await requireAdmin();
  const record = await getQuestionForEdit(id);
  if (!record) notFound();

  const now = new Date();
  const phase = questionPhase(record, now);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link
          href="/admin/soal"
          className="w-fit rounded text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          ← Kembali ke daftar soal
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit soal</h1>
          <Badge
            variant="outline"
            className={
              phase === 'terbuka' ? 'border-success/40 text-success' : 'border-border text-muted-foreground'
            }
          >
            {questionPhaseLabel(record, now)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatReleaseWindow(record.releaseDate)} · {record.submissionCount} kiriman anggota
        </p>
      </div>

      <QuestionForm
        initialValues={toQuestionFormValues(record)}
        submissionCount={record.submissionCount}
        initialImageUrl={record.imageUrl}
      />
    </div>
  );
}
