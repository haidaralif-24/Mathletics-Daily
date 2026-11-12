import { CircleCheck, CircleHelp, CircleX, Clock, Trophy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { OwnGrade } from './data';
import { wibTime } from './wib';

/**
 * M-7: the verdict, the points and the admin's feedback. The parent renders
 * this only once the question has closed, and `loadToday` only runs the grade
 * query then — so a graded-but-still-open question shows nothing here even if
 * somebody forces the component (RLS hides the row too).
 */
export function MemberResult({
  grade,
  submittedAtIso,
}: {
  grade: OwnGrade | null;
  submittedAtIso: string | null;
}) {
  if (!grade) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4" aria-hidden="true" />
            Menunggu penilaian
          </CardTitle>
          <CardDescription>
            Jawabanmu sudah masuk{submittedAtIso ? ` pukul ${wibTime(submittedAtIso)} WIB` : ''}. Admin
            akan menilai setelah soal ditutup; hasilnya muncul di halaman ini.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const verdict =
    grade.isCorrect === true
      ? {
          label: 'Benar',
          hint: 'Jawaban akhirmu tepat. Poin dasar dan poin kecepatan masuk.',
          icon: CircleCheck,
          className: 'text-success',
        }
      : {
          label: 'Belum tepat',
          hint: 'Langkah pengerjaan tetap dinilai, jadi poin langkah bisa saja masuk.',
          icon: CircleX,
          className: 'text-danger',
        };

  const VerdictIcon = verdict.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-4" aria-hidden="true" />
          Hasil
        </CardTitle>
        <CardDescription>Soal sudah ditutup dan dinilai admin.</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className={cn('flex items-center gap-2', verdict.className)}>
          <VerdictIcon className="size-5 shrink-0" aria-hidden="true" />
          <p className="font-heading text-lg font-semibold">{verdict.label}</p>
        </div>
        <p className="text-sm text-muted-foreground">{verdict.hint}</p>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <PointItem label="Dasar" value={grade.basePoints} />
          <PointItem label="Kecepatan" value={grade.speedPoints} />
          <PointItem label="Langkah" value={grade.stepsPoints} />
          <PointItem label="Total" value={grade.totalPoints ?? 0} emphasis />
        </dl>

        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Catatan dari admin
          </p>
          {grade.feedback ? (
            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
              {grade.feedback}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Tidak ada catatan khusus.</p>
          )}
        </div>

        {grade.needsRegrade ? (
          <p className="flex items-start gap-1.5 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            <CircleHelp className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Kamu mengubah langkah pengerjaan setelah dinilai, jadi admin akan memeriksa ulang.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PointItem({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className={cn('flex flex-col rounded-lg bg-muted px-3 py-2', emphasis && 'bg-secondary')}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('font-heading text-base font-semibold tabular-nums', emphasis && 'text-secondary-foreground')}>
        {value}
      </dd>
    </div>
  );
}
