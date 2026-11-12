'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * S-4: countdown to `closes_at`, corrected against server time on load.
 *
 * The device clock is never trusted: the server sends its own `now()`, the
 * offset between that and `Date.now()` is measured once on mount, and every
 * tick adds it back. A phone whose clock is a day off still counts down
 * correctly, and the first client render is byte-identical to the server one
 * (both start from the two ISO strings in props), so nothing flickers.
 */
interface CountdownProps {
  closesAtIso: string;
  serverNowIso: string;
  className?: string;
}

const pad = (value: number) => String(value).padStart(2, '0');

export function Countdown({ closesAtIso, serverNowIso, className }: CountdownProps) {
  const router = useRouter();
  const closesAt = Date.parse(closesAtIso);
  const serverNow = Date.parse(serverNowIso);

  const [remaining, setRemaining] = useState(() => Math.max(0, closesAt - serverNow));
  const refreshed = useRef(false);

  useEffect(() => {
    const offset = serverNow - Date.now();
    const tick = () => setRemaining(Math.max(0, closesAt - (Date.now() + offset)));

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [closesAt, serverNow]);

  // The instant the countdown runs out, ask the server for the closed state
  // (the database decides, not this component). Once only.
  useEffect(() => {
    if (remaining > 0 || refreshed.current) return;
    refreshed.current = true;
    router.refresh();
  }, [remaining, router]);

  if (!Number.isFinite(closesAt) || !Number.isFinite(serverNow)) return null;

  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const label = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-4xl bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground tabular-nums',
        className,
      )}
    >
      <Timer className="size-3.5" aria-hidden="true" />
      {/* The digits tick every second; a screen reader gets one calm sentence instead. */}
      <span aria-hidden="true">Tersisa {label}</span>
      <span className="sr-only">
        Soal ditutup dalam {hours} jam {minutes} menit
      </span>
    </span>
  );
}
