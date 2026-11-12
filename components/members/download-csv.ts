'use client';

/**
 * CSV helpers for the temporary-password hand-out (U-1 / A-4). Passwords exist
 * only in the browser for the duration of the request: the action never stores
 * them, so the admin downloads or copies them here or they are gone.
 */

export interface PasswordRow {
  email: string;
  displayName: string;
  className: string | null;
  temporaryPassword: string;
}

/**
 * Quotes every field and neutralises spreadsheet formulas: a cell starting with
 * `=`, `+`, `-` or `@` is executed by Excel, so it gets a leading apostrophe.
 */
function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function toPasswordCsv(rows: PasswordRow[]): string {
  const header = ['email', 'nama', 'kelas', 'kata_sandi'].map(csvCell).join(',');
  const body = rows.map((row) =>
    [row.email, row.displayName, row.className ?? '', row.temporaryPassword].map(csvCell).join(','),
  );
  return [header, ...body].join('\r\n');
}

export function downloadTextFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** File name for the download, in WIB so it matches what the admin sees. */
export function passwordFileName(): string {
  const stamp = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'short',
    timeStyle: 'short',
  })
    .format(new Date())
    .replace(/[^\d]+/g, '-');
  return `kata-sandi-sementara-${stamp}.csv`;
}
