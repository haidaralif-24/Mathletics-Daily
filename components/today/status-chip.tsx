import { Check, Clock, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { wibTime } from './wib';

/**
 * M-6: the status chip, computed on the server from the member's submission.
 * The three strings are exactly the ones in docs/UI_GUIDE.md.
 */

export type SubmissionStatus = 'belum' | 'terkirim' | 'dinilai';

export function StatusChip({
  status,
  submittedAtIso,
  className,
}: {
  status: SubmissionStatus;
  submittedAtIso?: string | null;
  className?: string;
}) {
  if (status === 'dinilai') {
    return (
      <Badge className={cn('h-6 gap-1 border-transparent bg-success px-2.5 text-success-foreground', className)}>
        <Check className="size-3.5" aria-hidden="true" />
        Sudah dinilai
      </Badge>
    );
  }

  if (status === 'terkirim') {
    return (
      <Badge variant="secondary" className={cn('h-6 gap-1 px-2.5', className)}>
        <Clock className="size-3.5" aria-hidden="true" />
        {submittedAtIso ? `Terkirim (${wibTime(submittedAtIso)} WIB)` : 'Terkirim'}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={cn('h-6 gap-1 px-2.5 text-muted-foreground', className)}>
      Belum dijawab
    </Badge>
  );
}

/** S-4 / M-4: the question's own state, so a closed question never looks open. */
export function QuestionStateChip({
  open,
  className,
}: {
  open: boolean;
  className?: string;
}) {
  if (open) {
    return (
      <Badge variant="outline" className={cn('h-6 px-2.5', className)}>
        Sedang dibuka
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={cn('h-6 gap-1 px-2.5', className)}>
      <Lock className="size-3.5" aria-hidden="true" />
      Soal ini sudah ditutup
    </Badge>
  );
}
