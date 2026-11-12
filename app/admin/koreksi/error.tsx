'use client';

import { useEffect } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Error boundary for /admin/koreksi. Next requires a client component; the copy
 * stays Bahasa Indonesia and never shows a raw message (SPEC section 5, "Copy").
 */
export default function KoreksiError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Kesalahan halaman koreksi:', error.digest ?? error.message);
  }, [error]);

  return (
    <section className="flex flex-col items-start gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10" role="alert">
      <h1 className="font-heading text-lg font-semibold tracking-tight">Halaman koreksi gagal dimuat</h1>
      <p className="text-sm text-muted-foreground">
        Nilai yang sudah tersimpan tetap aman. Coba muat ulang halaman ini.
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">
          Kode kesalahan: <code className="font-mono">{error.digest}</code>
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className={cn(buttonVariants({ variant: 'default' }), 'h-11 px-4')}
      >
        Coba lagi
      </button>
    </section>
  );
}
