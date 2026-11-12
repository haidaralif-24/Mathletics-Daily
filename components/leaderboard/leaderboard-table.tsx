'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { InfoIcon, Loader2Icon, RotateCwIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { loadLeaderboard } from '@/app/leaderboard/actions';
import { formatWib } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { LeaderboardPeriod, LeaderboardSnapshot } from './types';

/** L-1: the visible table. Only the Overall tab exists; the [P1] week tab reuses everything below. */
const VISIBLE_ROWS = 10;

/** L-4: no Realtime — poll every 45 s (within the 30-60 s the spec asks for). */
const POLL_MS = 45_000;

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: 'overall', label: 'Keseluruhan' },
];

interface LeaderboardTableProps {
  currentUserId: string;
  isAdmin: boolean;
  initial: LeaderboardSnapshot | null;
  initialError: string | null;
}

/**
 * L-2..L-5: rank, name, class, points, correct count and attempts, refreshed by
 * polling and on window focus. The caller's own row is highlighted and pinned to
 * the bottom of the screen, even when it falls outside the visible top 10 (L-3).
 */
export function LeaderboardTable({
  currentUserId,
  isAdmin,
  initial,
  initialError,
}: LeaderboardTableProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>('overall');
  const [snapshot, setSnapshot] = useState<LeaderboardSnapshot | null>(initial);
  const [error, setError] = useState<string | null>(initialError);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(
    async (target: LeaderboardPeriod) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setRefreshing(true);

      const result = await loadLeaderboard(target);

      inFlight.current = false;
      setRefreshing(false);

      if (!result.ok) {
        // Keep the last good table on screen; a background poll must not wipe it.
        setError(result.error.message);
        return;
      }

      setError(null);
      setSnapshot(result.data);
    },
    [],
  );

  // L-4: poll, and refresh again whenever the window regains focus.
  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      void refresh(period);
    };

    const interval = window.setInterval(tick, POLL_MS);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [period, refresh]);

  const rows = snapshot?.rows ?? [];
  const ownRow = rows.find((row) => row.userId === currentUserId) ?? null;
  const visibleRows = rows.slice(0, VISIBLE_ROWS);
  const ownRowIsVisible = ownRow !== null && visibleRows.some((row) => row.userId === currentUserId);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold tracking-tight">Papan Peringkat</h1>
        {/* L-4: the label is fixed copy from docs/UI_GUIDE.md. */}
        <p className="text-sm text-muted-foreground">
          Poin diperbarui setelah soal dinilai
          {snapshot ? ` · terakhir dimuat ${formatWib(new Date(snapshot.updatedAt))} WIB` : ''}
        </p>
      </header>

      <Tabs
        value={period}
        onValueChange={(value) => {
          if (typeof value !== 'string') return;
          const next = value as LeaderboardPeriod;
          setPeriod(next);
          void refresh(next);
        }}
      >
        <TabsList className="w-fit">
          {PERIODS.map((option) => (
            <TabsTrigger key={option.value} value={option.value}>
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overall">
          <Card>
            <CardHeader>
              <CardTitle>Keseluruhan</CardTitle>
              <CardDescription>
                Peringkat berdasarkan total poin. Seri dipisahkan oleh jumlah jawaban benar, lalu
                rata-rata waktu pengiriman.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-3">
              {error ? (
                <div
                  role="alert"
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
                >
                  <span className="flex-1">{error}</span>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() => void refresh(period)}
                  >
                    <RotateCwIcon aria-hidden="true" />
                    Coba lagi
                  </Button>
                </div>
              ) : null}

              {rows.length === 0 ? (
                <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-4">
                  <p className="text-sm font-medium">Papan peringkat masih kosong</p>
                  <p className="text-sm text-muted-foreground">
                    Poin muncul setelah admin menilai kiriman. Kerjakan soal hari ini dulu, ya.
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 pl-3">#</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Kelas</TableHead>
                        <TableHead className="text-right">Poin</TableHead>
                        <TableHead className="text-right">Benar</TableHead>
                        <TableHead className="pr-3 text-right">Dicoba</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleRows.map((row) => {
                        const own = row.userId === currentUserId;
                        return (
                          <TableRow key={row.userId} className={cn(own && 'bg-accent/70')}>
                            <TableCell className="pl-3 font-medium">{row.rank}</TableCell>
                            <TableCell className="max-w-32 truncate font-medium">
                              {row.displayName}
                              {own ? <span className="sr-only"> (kamu)</span> : null}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.className ?? '—'}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatPoints(row.totalPoints)}
                            </TableCell>
                            <TableCell className="text-right">{row.correctCount}</TableCell>
                            <TableCell className="pr-3 text-right">{row.attempted}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  <p className="text-xs text-muted-foreground">
                    Poin = total poin dari soal yang sudah dinilai · Benar = jumlah jawaban benar ·
                    Dicoba = jumlah soal yang dikerjakan.
                  </p>
                </>
              )}

              {refreshing ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
                  <Loader2Icon aria-hidden="true" className="size-3.5 animate-spin" />
                  Memperbarui...
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* L-3: the caller's own row, pinned to the bottom of the screen so it is
          always visible — even when the member is ranked below the top 10. */}
      {ownRow ? (
        <div
          role="region"
          aria-label="Peringkat kamu"
          className="sticky bottom-3 z-20 rounded-xl border border-primary/40 bg-card p-3 ring-2 ring-primary/30"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <Badge className="shrink-0">#{ownRow.rank}</Badge>
              <span className="truncate text-sm font-semibold">{ownRow.displayName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {ownRow.className ?? 'Tanpa kelas'}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold">
              {formatPoints(ownRow.totalPoints)} poin
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Benar {ownRow.correctCount} · Dicoba {ownRow.attempted}
            {ownRowIsVisible
              ? ' · barismu juga tersorot di daftar'
              : ` · di luar ${VISIBLE_ROWS} besar`}
          </p>
        </div>
      ) : isAdmin ? (
        <p
          role="status"
          className="sticky bottom-3 z-20 flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground ring-1 ring-foreground/10"
        >
          <InfoIcon aria-hidden="true" className="size-4 shrink-0" />
          Akun admin tidak ikut dihitung di papan peringkat.
        </p>
      ) : null}
    </div>
  );
}

/** numeric(4,1): 18 -> "18", 18.5 -> "18,5" (Indonesian decimal comma). */
function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}
