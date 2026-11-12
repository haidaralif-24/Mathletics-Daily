import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { EditorSkeleton } from '../skeletons';
import { emptyQuestionFormValues } from '../payload';
import { QuestionForm } from '../question-form';
import { findNextFreeReleaseDate } from '../data';

export const metadata: Metadata = {
  title: 'Soal baru',
  description: 'Tulis soal harian, kunci jawaban, dan mark scheme.',
};

/**
 * Q-1..Q-3: editor soal baru.
 *
 * Tanggal rilis awal diambil dari jadwal yang masih kosong (hari ini, atau hari
 * berikutnya kalau hari ini sudah terisi), jadi tabrakan tanggal tidak langsung
 * terjadi. Sesi dibaca di dalam <Suspense> karena `cacheComponents` aktif.
 */
export default function NewQuestionPage() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <NewQuestionScreen />
    </Suspense>
  );
}

async function NewQuestionScreen() {
  await requireAdmin();
  const releaseDate = await findNextFreeReleaseDate();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link
          href="/admin/soal"
          className="w-fit rounded text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          ← Kembali ke daftar soal
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Soal baru</h1>
        <p className="text-sm text-muted-foreground">
          Soal, kunci jawaban, dan mark scheme disimpan sekaligus. Tanpa kunci atau mark scheme,
          soal tetap tersimpan sebagai draf.
        </p>
      </div>

      <QuestionForm
        initialValues={emptyQuestionFormValues(releaseDate)}
        submissionCount={0}
        initialImageUrl={null}
      />
    </div>
  );
}
