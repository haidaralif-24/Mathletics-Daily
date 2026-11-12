import { Suspense } from 'react';
import type { Metadata } from 'next';
import { GradingWorkbench } from '@/components/grading/grading-workbench';
import { GradingScreenSkeleton } from '@/components/grading/skeletons';
import type { GradingQuestionOption, QuestionPhase } from '@/components/grading/types';
import { pickDefaultQuestion } from '@/components/grading/utils';
import { loadGradingRoster } from '@/lib/actions/grading';
import { requireAdmin } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { closesAtFor, isOpen, releaseAtFor } from '@/lib/time';

export const metadata: Metadata = {
  title: 'Koreksi',
  description: 'Nilai kiriman anggota terhadap kunci jawaban dan mark scheme.',
};

/**
 * R-1..R-7: the grading screen lives behind `app/admin/layout.tsx` (requireAdmin)
 * and reads the caller again here because the screen also needs the admin's own
 * identity. Session and question data are read inside <Suspense>: with
 * `cacheComponents` on, `cookies()` is uncached data and cannot be part of the
 * prerendered shell.
 */
export default function KoreksiPage() {
  return (
    <Suspense fallback={<GradingScreenSkeleton />}>
      <GradingScreen />
    </Suspense>
  );
}

async function GradingScreen() {
  await requireAdmin();

  const questions = await listQuestions();
  const initialQuestionId = pickDefaultQuestion(questions);

  // R-1: the roster for the default question is fetched here so the first paint is
  // already usable; the client only loads again when the admin switches question.
  const initialRoster = initialQuestionId ? await loadGradingRoster(initialQuestionId) : null;

  return (
    <GradingWorkbench
      questions={questions}
      initialQuestionId={initialQuestionId}
      initialRoster={initialRoster?.ok ? initialRoster.data : null}
      initialRosterError={initialRoster && !initialRoster.ok ? initialRoster.error.message : null}
    />
  );
}

/**
 * R-1: the question picker. Admins may read every question through RLS, released
 * or not (questions_select_admin), so this uses the session client.
 */
async function listQuestions(): Promise<GradingQuestionOption[]> {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('questions')
    .select('id, title, release_date, release_at, closes_at')
    .order('release_at', { ascending: false })
    .limit(60);

  const now = new Date();

  return (data ?? []).map((question) => {
    // Generated columns; lib/time.ts mirrors the database rule if one is ever null.
    const releaseAt = question.release_at ?? releaseAtFor(question.release_date).toISOString();
    const closesAt = question.closes_at ?? closesAtFor(new Date(releaseAt)).toISOString();

    let phase: QuestionPhase = 'released';
    if (isOpen(now, new Date(releaseAt), new Date(closesAt))) phase = 'open';
    else if (now < new Date(releaseAt)) phase = 'upcoming';

    return {
      id: question.id,
      title: question.title,
      releaseDate: question.release_date,
      releaseAt,
      closesAt,
      phase,
    };
  });
}
