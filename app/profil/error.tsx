'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/** Error state untuk /profil. */
export default function ProfilError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Kesalahan halaman profil:', error.digest ?? error.message);
  }, [error]);

  return (
    <section role="alert" className="flex flex-col items-start gap-3 py-6">
      <h1 className="font-heading text-xl font-semibold tracking-tight">Profil gagal dimuat</h1>
      <p className="text-sm text-muted-foreground">
        Datamu tidak berubah. Coba muat ulang; kalau masih gagal, hubungi admin klub.
      </p>
      <Button type="button" size="lg" className="h-11 px-4" onClick={reset}>
        Coba lagi
      </Button>
    </section>
  );
}
