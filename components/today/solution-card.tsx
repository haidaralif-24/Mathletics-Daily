import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, ListChecks } from 'lucide-react';
import type { PublishedSolution } from './data';
import { MathMarkdown } from './markdown';

/**
 * Q-5 / G-2 / H-2: the worked solution and (optionally) the mark scheme, shown
 * only after the question has closed. `loadPublishedSolution` refuses to build
 * this object while the question is open, so the component itself needs no
 * extra guard — it can simply not exist before close.
 */
export function SolutionCard({ solution }: { solution: PublishedSolution }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="size-4" aria-hidden="true" />
          Pembahasan
        </CardTitle>
        <CardDescription>
          Soal sudah ditutup, jadi kunci dan pembahasan boleh dibuka.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {solution.acceptedAnswers.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Jawaban yang diterima
            </p>
            <p className="font-mono text-base break-words text-foreground">
              {solution.acceptedAnswers.join(' · ')}
            </p>
          </div>
        ) : null}

        {solution.solutionMd ? (
          <MathMarkdown>{solution.solutionMd}</MathMarkdown>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada pembahasan tertulis untuk soal ini.</p>
        )}

        {solution.markscheme ? (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <ListChecks className="size-3.5" aria-hidden="true" />
              Kriteria penilaian langkah
            </p>
            <ul className="flex flex-col gap-2">
              {solution.markscheme.map((item) => (
                <li
                  key={item.position}
                  className="flex items-start justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm"
                >
                  <MathMarkdown className="text-sm">{item.descriptionMd}</MathMarkdown>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{item.points} poin</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
