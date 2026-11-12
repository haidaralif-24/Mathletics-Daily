'use client';

import { useId, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { importMembers, type ImportReport } from '@/lib/actions/members';
import { TempPasswordPanel } from './temp-password-panel';

const EXAMPLE = 'email,nama,kelas\nbudi@contoh.com,Budi Santoso,7A';

/**
 * U-1: paste or upload a roster CSV. Malformed and duplicate rows are reported
 * per line and never abort the import (SPEC section 6). The temporary passwords
 * appear once, below, with a CSV download.
 */
export function ImportMembersForm() {
  const csvId = useId();
  const fileId = useId();
  const [csv, setCsv] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      setCsv(await file.text());
    } catch {
      setError('File tidak bisa dibaca. Coba salin isinya ke kotak di bawah.');
    }
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await importMembers({ csv });
      if (!result.ok) {
        setReport(null);
        setError(result.error.message);
        return;
      }
      setReport(result.data);
    });
  };

  const imported = report?.rows.filter((row) => row.status === 'imported') ?? [];
  const skipped = report?.rows.filter((row) => row.status === 'skipped') ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Impor daftar anggota</CardTitle>
        <CardDescription>
          Satu baris per anggota: <code className="font-mono">email, nama, kelas</code>. Baris
          pertama boleh baris judul. Baris yang salah atau emailnya kembar dilewati dan
          dilaporkan, baris lain tetap masuk.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={fileId}>Unggah file CSV</Label>
            <input
              id={fileId}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="h-11 w-full rounded-lg border border-input bg-transparent px-2 text-sm file:mr-3 file:h-8 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:text-sm file:text-secondary-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={csvId}>Atau tempel isi CSV</Label>
            <Textarea
              id={csvId}
              value={csv}
              onChange={(event) => setCsv(event.target.value)}
              rows={6}
              spellCheck={false}
              placeholder={EXAMPLE}
              className="font-mono text-xs"
              aria-describedby={`${csvId}-hint`}
            />
            <p id={`${csvId}-hint`} className="text-xs text-muted-foreground">
              Koma, titik koma, atau tab semuanya bisa jadi pemisah kolom.
            </p>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="h-11 w-full px-4 sm:w-fit"
            disabled={pending || csv.trim().length === 0}
            aria-busy={pending}
          >
            {pending ? 'Mengimpor...' : 'Impor anggota'}
          </Button>
        </form>

        {report ? (
          <div className="flex flex-col gap-3">
            <p role="status" className="text-sm text-foreground">
              <span className="font-medium">{report.importedCount} akun dibuat</span>
              {report.skippedCount > 0 ? `, ${report.skippedCount} baris dilewati.` : '.'}
            </p>

            <TempPasswordPanel
              rows={imported.map((row) => ({
                email: row.email,
                displayName: row.displayName,
                className: row.className,
                temporaryPassword: row.temporaryPassword ?? '',
              }))}
            />

            {imported.some((row) => row.note) ? (
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {imported
                  .filter((row) => row.note)
                  .map((row) => (
                    <li key={`note-${row.line}`}>
                      Baris {row.line} ({row.email}): {row.note}
                    </li>
                  ))}
              </ul>
            ) : null}

            {skipped.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
                <h3 className="font-heading text-sm font-semibold text-foreground">
                  Baris yang dilewati
                </h3>
                <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {skipped.map((row) => (
                    <li key={`skip-${row.line}`}>
                      Baris {row.line}
                      {row.email ? ` (${row.email})` : ''}: {row.reason}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Perbaiki barisnya, tempel ulang, lalu impor lagi. Baris yang sudah masuk akan
                  dilaporkan sebagai email terdaftar.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
