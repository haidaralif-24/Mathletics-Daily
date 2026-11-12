'use client';

import { useEffect } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Root error boundary. Next requires this to be a client component.
 * Copy stays Bahasa Indonesia and never leaks a raw error message
 * (SPEC section 5, "Copy").
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only safe thing to surface to the server logs.
    console.error('Kesalahan halaman:', error.digest ?? error.message);
  }, [error]);

  return (
    <section className="flex flex-col items-start gap-4 py-10" role="alert">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Ada yang tidak beres</h1>
      <p className="text-sm text-muted-foreground">
        Halaman ini gagal dimuat. Coba muat ulang; kalau masih gagal, hubungi admin klub.
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">
          Kode kesalahan: <code className="font-mono">{error.digest}</code>
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className={cn(buttonVariants({ variant: 'default' }), 'min-h-11 px-4')}
      >
        Coba lagi
      </button>
    </section>
  );
}
