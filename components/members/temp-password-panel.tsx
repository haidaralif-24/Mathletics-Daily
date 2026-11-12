'use client';

import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  downloadTextFile,
  passwordFileName,
  toPasswordCsv,
  type PasswordRow,
} from './download-csv';

/**
 * U-1 / A-4: temporary passwords are shown exactly once, here, with a download
 * so the admin can hand them out on slips. Nothing is stored server-side.
 */
export function TempPasswordPanel({
  rows,
  heading = 'Kata sandi sementara',
  hint = 'Tampil sekali saja. Unduh atau salin sekarang sebelum halaman ditutup.',
}: {
  rows: PasswordRow[];
  heading?: string;
  hint?: string;
}) {
  if (rows.length === 0) return null;

  const copy = async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success('Kata sandi disalin.');
    } catch {
      toast.error('Gagal menyalin. Salin manual dari tabel, ya.');
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-success/50 bg-success/10 p-3">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-sm font-semibold text-foreground">{heading}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Kata sandi sementara yang baru dibuat</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="py-1 pr-2 font-medium">
                Email
              </th>
              <th scope="col" className="py-1 pr-2 font-medium">
                Nama
              </th>
              <th scope="col" className="py-1 pr-2 font-medium">
                Kata sandi
              </th>
              <th scope="col" className="py-1 font-medium">
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.email} className="border-t border-border/60 align-middle">
                <td className="py-1.5 pr-2 break-all">{row.email}</td>
                <td className="py-1.5 pr-2">{row.displayName}</td>
                <td className="py-1.5 pr-2 font-mono text-sm">{row.temporaryPassword}</td>
                <td className="py-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-3"
                    onClick={() => copy(row.temporaryPassword)}
                  >
                    Salin
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-11 w-full px-4 sm:w-fit"
        onClick={() => downloadTextFile(passwordFileName(), toPasswordCsv(rows))}
      >
        Unduh CSV kata sandi
      </Button>
    </div>
  );
}
