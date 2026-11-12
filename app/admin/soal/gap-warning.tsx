import Link from 'next/link';
import { TriangleAlertIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Q-2: banner peringatan celah jadwal. Dipakai di `/admin` dan `/admin/soal`
 * dengan kalimat yang sama, termasuk "Belum ada soal untuk besok".
 * Tidak dirender kalau jadwalnya lengkap.
 */
export function GapWarnings({
  warnings,
  withAction = false,
  className,
}: {
  warnings: readonly string[];
  /** Tautan "Tambah soal" untuk admin yang baru pertama kali melihatnya. */
  withAction?: boolean;
  className?: string;
}) {
  if (warnings.length === 0) return null;

  return (
    <section
      aria-labelledby="peringatan-jadwal-soal"
      className={cn(
        'rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger',
        className,
      )}
    >
      <h2
        id="peringatan-jadwal-soal"
        className="flex items-center gap-2 font-heading text-sm font-semibold"
      >
        <TriangleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
        Jadwal soal belum lengkap
      </h2>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
      {withAction ? (
        <p className="mt-2">
          <Link
            href="/admin/soal/baru"
            className="font-medium underline underline-offset-3 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Tambah soal sekarang
          </Link>
        </p>
      ) : null}
    </section>
  );
}
