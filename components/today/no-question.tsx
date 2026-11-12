import Link from 'next/link';
import { CalendarDays, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { wibDateTime } from './wib';

/**
 * S-3. Exactly one sentence when the next question is already scheduled —
 * "Soal berikutnya rilis {tanggal} pukul {jam} WIB" — and a friendly empty
 * state when nothing is scheduled at all.
 *
 * The next release instant is the one timestamp `loadToday` reads with the
 * service role: an unreleased question body stays unfetchable (S-5), but the
 * schedule itself is public, which is the whole point of this line.
 */
export function NoQuestionCard({
  nextReleaseAtIso,
  signedIn,
}: {
  nextReleaseAtIso: string | null;
  signedIn: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {nextReleaseAtIso ? (
            <CalendarDays className="size-4" aria-hidden="true" />
          ) : (
            <Sparkles className="size-4" aria-hidden="true" />
          )}
          Belum ada soal yang bisa dikerjakan
        </CardTitle>
        <CardDescription>
          {nextReleaseAtIso
            ? `Soal berikutnya rilis ${wibDateTime(nextReleaseAtIso)}`
            : 'Belum ada soal yang terjadwal. Tunggu kabar dari admin klub, ya.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col items-start gap-4">
        <p className="text-sm text-muted-foreground">
          Soal baru muncul otomatis setiap hari pukul 04.00 WIB dan terbuka selama 24 jam penuh.
          {signedIn
            ? ' Kamu bisa kembali kapan saja selama jendela itu untuk mengirim jawaban.'
            : ' Kalau kamu anggota klub, masuk dulu supaya jawabanmu bisa dinilai.'}
        </p>

        {signedIn ? null : (
          <Link
            href="/login"
            className={cn(
              'inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50',
            )}
          >
            Masuk
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

/** S-3 while a closed question is still on screen: point at the next one. */
export function NextReleaseNote({ nextReleaseAtIso }: { nextReleaseAtIso: string | null }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
      <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {nextReleaseAtIso
        ? `Soal berikutnya rilis ${wibDateTime(nextReleaseAtIso)}`
        : 'Belum ada soal berikutnya yang terjadwal. Tunggu kabar dari admin klub, ya.'}
    </p>
  );
}
