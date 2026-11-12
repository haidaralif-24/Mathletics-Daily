'use client';

import { useState, type FormEvent } from 'react';
import { CircleCheck, CircleHelp, CircleX, Info, LoaderCircle, Send } from 'lucide-react';
import { toast } from 'sonner';

import { checkGuestAnswer, type GuestCheck as GuestCheckResult } from '@/lib/actions/guest';
import { LIMITS } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * G-1..G-3 for signed-out visitors: type a final answer, get a verdict.
 *
 * No attachments, no account, nothing stored. While the question is open the
 * server action returns `{ state: 'open' }` — a payload with no verdict and no
 * key field at all (docs/UI_GUIDE.md copy: "Hasil tersedia setelah soal
 * ditutup"). After close the same action returns the verdict plus the accepted
 * answers.
 */

/** docs/UI_GUIDE.md, verbatim. */
const OPEN_HINT = 'Hasil tersedia setelah soal ditutup';

export function GuestCheck({ questionId, closed }: { questionId: string; closed: boolean }) {
  const [answer, setAnswer] = useState('');
  const [pending, setPending] = useState(false);
  const [checked, setChecked] = useState(false);
  const [result, setResult] = useState<GuestCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);

    try {
      const response = await checkGuestAnswer({ questionId, answer });

      if (!response.ok) {
        setError(response.error.message);
        toast.error(response.error.message);
        return;
      }

      setResult(response.data);
      setChecked(true);
    } catch {
      const message = 'Tidak bisa memeriksa jawaban sekarang. Coba lagi.';
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  const verdict = result?.state === 'closed' ? result : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coba jawab sebagai tamu</CardTitle>
        <CardDescription>
          {closed
            ? 'Soal sudah ditutup. Tulis jawabanmu di bawah untuk melihat hasil dan jawaban yang benar.'
            : 'Tulis jawaban akhirmu, lalu periksa setelah soal ditutup. Tanpa akun, tanpa lampiran, dan tidak ada yang kami simpan.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
          <Label htmlFor="jawaban-tamu">Jawaban akhir</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="jawaban-tamu"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              maxLength={LIMITS.finalAnswerMaxChars}
              required
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Contoh: 3/4"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'jawaban-tamu-error' : undefined}
              className="h-11 text-base"
            />
            <Button type="submit" className="h-11 px-4 sm:w-40" disabled={pending} aria-busy={pending}>
              {pending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Send aria-hidden="true" />
              )}
              {pending ? 'Memeriksa...' : 'Periksa jawaban'}
            </Button>
          </div>
        </form>

        {error ? (
          <p id="jawaban-tamu-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {!closed ? (
          <p
            role={checked ? 'status' : undefined}
            className={cn(
              'flex items-center gap-2 text-sm text-muted-foreground',
              checked && 'rounded-lg bg-muted px-3 py-2 text-foreground',
            )}
          >
            <Info className="size-4 shrink-0" aria-hidden="true" />
            {OPEN_HINT}
          </p>
        ) : null}

        {verdict ? (
          <div
            role="status"
            className="flex flex-col gap-2 rounded-lg border border-border bg-muted px-3 py-3"
          >
            <p className="flex items-center gap-2">
              {verdict.verdict === 'correct' ? (
                <>
                  <CircleCheck className="size-5 shrink-0 text-success" aria-hidden="true" />
                  <span className="font-heading text-base font-semibold text-success">Benar</span>
                </>
              ) : verdict.verdict === 'wrong' ? (
                <>
                  <CircleX className="size-5 shrink-0 text-danger" aria-hidden="true" />
                  <span className="font-heading text-base font-semibold text-danger">Belum tepat</span>
                </>
              ) : (
                <>
                  <CircleHelp className="size-5 shrink-0 text-foreground" aria-hidden="true" />
                  <span className="font-heading text-base font-semibold text-foreground">
                    Perlu diperiksa manual
                  </span>
                </>
              )}
            </p>

            {verdict.verdict === 'needs_review' ? (
              <p className="text-sm text-muted-foreground">
                Jawabanmu tidak bisa dibandingkan otomatis dengan kunci. Bandingkan sendiri dengan jawaban
                yang diterima di bawah ini.
              </p>
            ) : null}

            {verdict.acceptedAnswers.length > 0 ? (
              <p className="text-sm break-words text-foreground">
                Jawaban yang diterima:{' '}
                <span className="font-mono">{verdict.acceptedAnswers.join(' · ')}</span>
              </p>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Pembahasan lengkap ada di kartu di bawah. Tidak ada yang kami simpan dari percobaanmu.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
