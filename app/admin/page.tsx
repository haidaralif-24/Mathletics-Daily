import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRightIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { requireAdmin } from '@/lib/auth';
import { GapWarnings } from './soal/gap-warning';
import { AdminDashboardSkeleton } from './soal/skeletons';
import { loadAdminDashboard, type AdminDashboardData } from './soal/data';
import {
  formatWibDate,
  formatWibParts,
  questionPhase,
  questionPhaseLabel,
  type QuestionOverview,
} from './soal/payload';

export const metadata: Metadata = {
  title: 'Dasbor admin',
  description: 'Peringatan jadwal soal, kiriman yang belum dinilai, dan pintasan kerja admin.',
};

/**
 * Dasbor admin: peringatan celah jadwal (Q-2), jumlah kiriman yang belum
 * dinilai (R-1), dan tautan ke layar admin lainnya.
 *
 * Sesi dibaca di dalam <Suspense> karena `cacheComponents` aktif; halaman ini
 * memakai klien service role (setelah `requireAdmin`) untuk membaca kunci
 * jawaban dan mark scheme yang tidak punya policy baca untuk klien.
 */
export default function AdminHomePage() {
  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <AdminDashboard />
    </Suspense>
  );
}

async function AdminDashboard() {
  const user = await requireAdmin();
  const data = await loadAdminDashboard();
  const now = new Date();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Dasbor admin</h1>
        <p className="text-sm text-muted-foreground">
          Halo {user.displayName}. Ini yang menunggu hari ini.
        </p>
      </div>

      <GapWarnings warnings={data.gapWarnings} withAction />

      {data.gapWarnings.length === 0 ? (
        <p className="rounded-xl border border-success/40 bg-success/10 p-3 text-sm text-success">
          Jadwal aman: soal untuk hari ini dan besok sudah ada.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Belum dinilai"
          value={data.pendingGrading}
          hint={`Dari ${data.submissionsTotal} kiriman masuk`}
          href="/admin/koreksi"
        />
        <StatCard
          label="Perlu dinilai ulang"
          value={data.needsRegrade}
          hint="Langkah pengerjaan berubah setelah dinilai"
          href="/admin/koreksi"
        />
        <StatCard
          label="Kiriman masuk"
          value={data.submissionsTotal}
          hint={`${data.gradedTotal} sudah dinilai`}
          href="/admin/koreksi"
        />
        <StatCard
          label="Total soal"
          value={data.totalQuestions}
          hint="Semua soal yang pernah dibuat"
          href="/admin/soal"
        />
      </div>

      <NextScheduleCard
        nextQuestion={data.nextQuestion}
        recentQuestions={data.recentQuestions}
        now={now}
      />

      <Card>
        <CardHeader>
          <CardTitle>Pintasan</CardTitle>
          <CardDescription>Layar admin lainnya.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-2">
            {SHORTCUTS.map((shortcut) => (
              <li key={shortcut.href}>
                <Link
                  href={shortcut.href}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-primary outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {shortcut.label}
                  <ArrowRightIcon className="size-4" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

const SHORTCUTS = [
  { href: '/admin/soal', label: 'Kelola soal' },
  { href: '/admin/koreksi', label: 'Nilai kiriman' },
  { href: '/admin/member', label: 'Kelola anggota' },
];

function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number;
  hint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-colors hover:bg-accent/60">
        <CardContent className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="font-heading text-2xl font-semibold tabular-nums text-foreground">
            {value}
          </span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </CardContent>
      </Card>
    </Link>
  );
}

function NextScheduleCard({
  nextQuestion,
  recentQuestions,
  now,
}: {
  nextQuestion: AdminDashboardData['nextQuestion'];
  recentQuestions: readonly QuestionOverview[];
  now: Date;
}) {
  const parts = nextQuestion ? formatWibParts(new Date(nextQuestion.releaseAt)) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jadwal soal</CardTitle>
        <CardDescription>
          {parts
            ? `Soal berikutnya rilis ${parts.date} pukul ${parts.time} WIB.`
            : 'Belum ada soal berikutnya yang terjadwal.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recentQuestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada soal sama sekali.{' '}
            <Link href="/admin/soal/baru" className="font-medium text-primary underline underline-offset-3">
              Tambah soal pertama
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recentQuestions.map((question) => {
              const phase = questionPhase(question, now);
              return (
                <li key={question.id}>
                  <Link
                    href={`/admin/soal/${question.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg p-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{question.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatWibDate(question.releaseDate)}
                        {question.topic ? ` · ${question.topic}` : ''}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {question.hasKey ? null : (
                        <Badge variant="outline" className="border-danger/40 text-danger">
                          Kunci belum diisi
                        </Badge>
                      )}
                      {question.hasMarkScheme ? null : (
                        <Badge variant="outline" className="border-danger/40 text-danger">
                          Mark scheme belum diisi
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          phase === 'terbuka'
                            ? 'border-success/40 text-success'
                            : 'border-border text-muted-foreground',
                        )}
                      >
                        {questionPhaseLabel(question, now)}
                      </Badge>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
