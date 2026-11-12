'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/** Error state untuk /ganti-sandi. */
export default function ChangePasswordError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Kesalahan halaman ubah kata sandi:', error.digest ?? error.message);
  }, [error]);

  return (
    <section
      role="alert"
      className="mx-auto flex w-full max-w-sm flex-col items-start gap-3 py-6"
    >
      <h1 className="font-heading text-xl font-semibold tracking-tight">
        Halaman ini gagal dimuat
      </h1>
      <p className="text-sm text-muted-foreground">
        Kata sandimu belum berubah. Coba lagi; kalau masih gagal, hubungi admin klub.
      </p>
      <Button type="button" size="lg" className="h-11 px-4" onClick={reset}>
        Coba lagi
      </Button>
    </section>
  );
}
