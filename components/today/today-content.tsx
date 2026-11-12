import Link from 'next/link';
import { CircleAlert, Info } from 'lucide-react';
import { getSessionUser } from '@/lib/auth';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GuestCheck } from '@/components/guest/guest-check';
import { Countdown } from './countdown';
import { loadToday } from './data';
import { MemberResult } from './member-result';
import { NextReleaseNote, NoQuestionCard } from './no-question';
import { QuestionCard } from './question-card';
import { QuestionStateChip, StatusChip, type SubmissionStatus } from './status-chip';
import { SolutionCard } from './solution-card';
import { NoSubmissionNote, SubmissionSummary } from './submission-summary';
import { SubmitForm } from './submit-form';

/**
 * The Today screen, member view and guest view in one place (S-3, S-4, M-1..M-8,
 * G-1..G-3).
 *
 * Reads the session cookie, so it must stay inside a `<Suspense>` boundary
 * (`cacheComponents` is on): app/page.tsx provides the shell and the skeleton.
 */
export async function TodayContent() {
  const user = await getSessionUser();
  const today = await loadToday(user?.id ?? null);

  if (today.status === 'error') return <LoadError />;

  const { question, submission, grade, solution, nextReleaseAtIso, serverNowIso } = today;

  const isMember = user?.role === 'member';
  // Only an active member writes a submission (SPEC section 3): admins never
  // submit, and the database would refuse anyway.
  const canSubmit = user?.role === 'member' && user.active;
  const showGuestCheck = !isMember;

  // M-6.
  const status: SubmissionStatus = grade ? 'dinilai' : submission ? 'terkirim' : 'belum';

  return (
    <section className="flex flex-col gap-4" aria-labelledby="judul-hari-ini">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 id="judul-hari-ini" className="font-heading text-2xl font-semibold tracking-tight">
          Hari Ini
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          {question ? (
            question.open ? (
              // S-4: countdown corrected against server time on load.
              <Countdown closesAtIso={question.closesAtIso} serverNowIso={serverNowIso} />
            ) : (
              <QuestionStateChip open={false} />
            )
          ) : null}
          {isMember ? (
            <StatusChip status={status} submittedAtIso={submission?.firstSubmittedAtIso ?? null} />
          ) : null}
        </div>
      </div>

      {question ? (
        <>
          <QuestionCard question={question} />

          {/* Open question */}
          {question.open && canSubmit ? (
            <SubmitForm
              questionId={question.id}
              userId={user.id}
              initial={{
                finalAnswer: submission?.finalAnswer ?? '',
                stepsText: submission?.stepsText ?? '',
                photos:
                  submission?.photoPaths.map((path, index) => ({
                    path,
                    url: submission.photoUrls[index] ?? null,
                  })) ?? [],
                firstSubmittedAtIso: submission?.firstSubmittedAtIso ?? null,
              }}
            />
          ) : null}

          {question.open && isMember && !user.active ? (
            <Notice tone="warning">
              Akunmu sedang tidak aktif, jadi jawaban tidak bisa dikirim. Hubungi admin klub untuk
              mengaktifkannya lagi.
            </Notice>
          ) : null}

          {question.open && showGuestCheck ? <GuestCheck questionId={question.id} closed={false} /> : null}

          {/* Closed question */}
          {!question.open && isMember ? (
            submission ? (
              <>
                <SubmissionSummary submission={submission} />
                {/* M-7: only rendered once the question has closed. */}
                <MemberResult
                  grade={grade}
                  submittedAtIso={submission.firstSubmittedAtIso}
                />
              </>
            ) : (
              <NoSubmissionNote />
            )
          ) : null}

          {/* G-2: guests (and admins, who never submit) check an answer here. */}
          {!question.open && showGuestCheck ? <GuestCheck questionId={question.id} closed /> : null}

          {/* Q-5 / H-2: solution and key, only ever after close. */}
          {!question.open && solution ? <SolutionCard solution={solution} /> : null}

          {/* S-3 while a closed question is still on screen. */}
          {!question.open ? <NextReleaseNote nextReleaseAtIso={nextReleaseAtIso} /> : null}

          {user?.role === 'admin' ? (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Kamu masuk sebagai admin, jadi tidak mengirim jawaban. Menilai kiriman anggota ada di{' '}
              <Link href="/admin/koreksi" className="text-primary underline underline-offset-4">
                halaman Koreksi
              </Link>
              .
            </p>
          ) : null}
        </>
      ) : (
        <NoQuestionCard nextReleaseAtIso={nextReleaseAtIso} signedIn={user !== null} />
      )}
    </section>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: 'warning' | 'info';
  children: React.ReactNode;
}) {
  return (
    <p
      className={
        tone === 'warning'
          ? 'flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'
          : 'flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground'
      }
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

/** Error state: the question could not be read at all. */
function LoadError() {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="judul-hari-ini">
      <h1 id="judul-hari-ini" className="font-heading text-2xl font-semibold tracking-tight">
        Hari Ini
      </h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleAlert className="size-4 text-destructive" aria-hidden="true" />
            Soal hari ini gagal dimuat
          </CardTitle>
          <CardDescription>
            Sambungan ke server sedang bermasalah. Coba muat ulang halaman ini sebentar lagi.
          </CardDescription>
        </CardHeader>
      </Card>
    </section>
  );
}
