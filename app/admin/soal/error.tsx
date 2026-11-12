'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Error state untuk `/admin/soal` (docs/UI_GUIDE.md). Pesan database mentah
 * tidak pernah ditampilkan; hanya kode kesalahan (digest) yang aman.
 */
export default function SoalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Kesalahan halaman soal:', error.digest ?? error.message);
  }, [error]);

  return (
    <section role="alert" className="flex flex-col items-start gap-3 py-6">
      <h1 className="font-heading text-xl font-semibold tracking-tight">
        Daftar soal gagal dimuat
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Coba muat ulang halaman ini. Kalau masih gagal, periksa koneksi ke database lalu hubungi
        admin teknis klub.
      </p>
      <Button type="button" className="min-h-11 px-4" onClick={reset}>
        Coba lagi
      </Button>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">
          Kode kesalahan: <code className="font-mono">{error.digest}</code>
        </p>
      ) : null}
    </section>
  );
}
