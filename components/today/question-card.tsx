import { Clock, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { TodayQuestion } from './data';
import { MathMarkdown } from './markdown';
import { ZoomableImage } from './zoomable-image';
import { wibDateTime } from './wib';

/** 1-5, shown as a word: the number means little to a student at 04.00. */
const DIFFICULTY_LABEL: Record<number, string> = {
  1: 'Mudah',
  2: 'Mudah',
  3: 'Sedang',
  4: 'Sulit',
  5: 'Sulit',
};

/**
 * S-4: title, release time and the rendered question with the optional
 * diagram. The body is Markdown + `$LaTeX$` through `MathMarkdown`, which never
 * enables `rehype-raw` (hard rule 6).
 */
export function QuestionCard({ question }: { question: TodayQuestion }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0" aria-hidden="true" />
            <time dateTime={question.releaseAtIso}>Rilis {wibDateTime(question.releaseAtIso)}</time>
          </span>
          {question.topic ? (
            <Badge variant="outline" className="h-5 px-2">
              {question.topic}
            </Badge>
          ) : null}
          {question.difficulty ? (
            <Badge variant="outline" className="h-5 px-2">
              {DIFFICULTY_LABEL[question.difficulty] ?? `Tingkat ${question.difficulty}`}
            </Badge>
          ) : null}
        </div>

        <h2 className="font-heading text-xl leading-snug font-semibold tracking-tight text-foreground">
          {question.title}
        </h2>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <MathMarkdown>{question.bodyLatex}</MathMarkdown>

        {question.imageUrl ? (
          <ZoomableImage src={question.imageUrl} alt={`Diagram soal: ${question.title}`} />
        ) : null}

        {question.open ? null : (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5 shrink-0" aria-hidden="true" />
            Soal ini sudah ditutup pada {wibDateTime(question.closesAtIso)}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
