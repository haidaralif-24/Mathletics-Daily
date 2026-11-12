/**
 * Perhitungan sisipan teks murni untuk toolbar LaTeX (Q-1).
 *
 * Dipisah dari komponen supaya bisa diuji dan dipakai ulang: komponen hanya
 * membaca posisi kursor asli dari `<textarea>` (selectionStart/selectionEnd),
 * lalu fungsi ini menghitung teks baru dan posisi kursor berikutnya.
 */

export interface InsertionTemplate {
  before: string;
  after: string;
  /** Offset caret di dalam `before + after` saat tidak ada pilihan teks. */
  caret?: number;
}

export interface InsertionResult {
  /** Isi textarea setelah penyisipan. */
  value: string;
  /** Teks pengganti untuk rentang [start, end) — dipakai `setRangeText`. */
  replacement: string;
  /** Rentang yang digantikan di teks lama. */
  start: number;
  end: number;
  /** Posisi kursor setelah penyisipan (collapsed selection). */
  caret: number;
}

/** Menjaga posisi kursor tetap di dalam teks, dan start <= end. */
export function clampSelection(length: number, start: number, end: number): [number, number] {
  const safeStart = Math.min(Math.max(Number.isFinite(start) ? start : length, 0), length);
  const safeEnd = Math.min(Math.max(Number.isFinite(end) ? end : safeStart, safeStart), length);
  return [safeStart, safeEnd];
}

/**
 * Menyisipkan template pada posisi kursor, atau membungkus teks yang dipilih.
 * Kursor mendarat di dalam kurung kurawal saat tidak ada pilihan teks, dan di
 * ujung sisipan saat ada pilihan teks.
 */
export function buildInsertion(
  template: InsertionTemplate,
  value: string,
  selectionStart: number,
  selectionEnd: number,
): InsertionResult {
  const [start, end] = clampSelection(value.length, selectionStart, selectionEnd);
  const selected = value.slice(start, end);
  const replacement = `${template.before}${selected}${template.after}`;

  const insideOffset = template.caret ?? template.before.length;
  const caret = selected
    ? start + replacement.length
    : start + Math.min(Math.max(insideOffset, 0), replacement.length);

  return {
    value: `${value.slice(0, start)}${replacement}${value.slice(end)}`,
    replacement,
    start,
    end,
    caret,
  };
}
