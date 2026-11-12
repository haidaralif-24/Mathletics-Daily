import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function NotFound() {
  return (
    <section className="flex flex-col items-start gap-4 py-10">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Halaman tidak ditemukan</h1>
      <p className="text-sm text-muted-foreground">
        Alamat yang kamu buka tidak ada. Mungkin tautannya salah ketik.
      </p>
      <Link href="/" className={cn(buttonVariants({ variant: 'default' }), 'min-h-11 px-4')}>
        Kembali ke soal hari ini
      </Link>
    </section>
  );
}
