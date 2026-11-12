'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/** Error state untuk /admin/member. Tanpa detail teknis, tanpa data anggota. */
export default function AdminMemberError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Kesalahan halaman member:', error.digest ?? error.message);
  }, [error]);

  return (
    <section role="alert" className="flex flex-col items-start gap-3 py-6">
      <h1 className="font-heading text-xl font-semibold tracking-tight">
        Halaman member gagal dimuat
      </h1>
      <p className="text-sm text-muted-foreground">
        Tidak ada data anggota yang berubah. Coba lagi; kalau masih gagal, hubungi admin lain.
      </p>
      <Button type="button" size="lg" className="h-11 px-4" onClick={reset}>
        Coba lagi
      </Button>
    </section>
  );
}
