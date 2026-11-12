import katex from 'katex';

/**
 * Pemeriksaan LaTeX (Q-1: "Saving is blocked if KaTeX cannot parse the text").
 *
 * Fungsi di berkas ini murni (hanya bergantung pada `katex`) sehingga dipakai
 * DUA kali:
 *  - di klien, sebagai umpan balik langsung saat admin menulis (UX), dan
 *  - di server action, sebagai penjaga sebelum tulisan masuk ke database.
 * Keduanya memakai kode yang sama, jadi tidak mungkin berbeda pendapat.
 *
 * Isi biasa (markdown) tidak pernah gagal diparse, jadi yang diperiksa hanya
 * rumus di antara `$...$` (inline) dan `$$...$$` (blok) — persis yang dikenali
 * `remark-math` di pratinjau.
 */

export interface MathSegment {
  /** Isi LaTeX tanpa tanda `$`. */
  source: string;
  displayMode: boolean;
  /** Indeks karakter pertama `source` di dalam teks asli. */
  start: number;
}

export interface KatexProblem {
  kind: 'parse' | 'unterminated';
  source: string;
  displayMode: boolean;
  start: number;
  /** Pesan asli dari KaTeX (Bahasa Inggris, hanya untuk admin). */
  message: string;
}

export interface MathScanResult {
  segments: MathSegment[];
  /** Pembuka `$$` yang tidak pernah ditutup. */
  unterminated: MathSegment[];
}

export type KatexCheckResult =
  | { ok: true; segments: MathSegment[] }
  | { ok: false; segments: MathSegment[]; problems: KatexProblem[] };

/** Hanya ini jumlah masalah yang dilaporkan; sisanya cukup dihitung. */
const MAX_PROBLEMS = 5;

const isWhitespace = (char: string | undefined): boolean => char === undefined || /\s/.test(char);

/** `\$` dan `\\$` tidak membuka rumus. */
function isEscaped(text: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && text[i] === '\\'; i -= 1) backslashes += 1;
  return backslashes % 2 === 1;
}

function findClosing(text: string, delimiter: string, from: number): number {
  for (let i = from; i < text.length - delimiter.length + 1; i += 1) {
    if (!text.startsWith(delimiter, i)) continue;
    if (isEscaped(text, i)) continue;
    return i;
  }
  return -1;
}

/**
 * Penutup `$` inline harus berada di baris yang sama dan tidak didahului spasi
 * (aturan yang sama dipakai remark-math; lihat `micromark-extension-math`).
 * Kalau tidak ketemu, `$` dianggap teks biasa — misalnya "harga $5 dan $7".
 */
function findInlineClose(text: string, from: number): number {
  for (let i = from; i < text.length; i += 1) {
    const char = text[i];
    if (char === '\n') return -1;
    if (char === '\\') {
      i += 1;
      continue;
    }
    if (char !== '$') continue;
    if (isWhitespace(text[i - 1])) continue;
    return i;
  }
  return -1;
}

/** Memindai `$...$` dan `$$...$$`. Mendekati perilaku remark-math. */
export function scanMath(text: string): MathScanResult {
  const segments: MathSegment[] = [];
  const unterminated: MathSegment[] = [];

  let i = 0;
  while (i < text.length) {
    const char = text[i];

    if (char === '\\') {
      i += 2;
      continue;
    }

    if (char !== '$') {
      i += 1;
      continue;
    }

    if (text[i + 1] === '$') {
      const close = findClosing(text, '$$', i + 2);
      if (close === -1) {
        unterminated.push({ source: text.slice(i + 2), displayMode: true, start: i + 2 });
        break;
      }
      segments.push({ source: text.slice(i + 2, close), displayMode: true, start: i + 2 });
      i = close + 2;
      continue;
    }

    const next = text[i + 1];
    if (isWhitespace(next)) {
      // "$ 5" bukan pembuka rumus.
      i += 1;
      continue;
    }

    const close = findInlineClose(text, i + 1);
    if (close === -1) {
      i += 1;
      continue;
    }

    segments.push({ source: text.slice(i + 1, close), displayMode: false, start: i + 1 });
    i = close + 1;
  }

  return { segments, unterminated };
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Rumus tidak bisa dibaca.';
}

/** Memotong rumus panjang supaya pesan tetap terbaca di layar 360 px. */
export function truncateSource(source: string, max = 60): string {
  const flat = source.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/**
 * true kalau semua rumus di dalam teks bisa dirender KaTeX.
 * Teks tanpa rumus selalu lolos.
 */
export function checkKatexText(text: string): KatexCheckResult {
  if (!text.trim()) return { ok: true, segments: [] };

  const { segments, unterminated } = scanMath(text);
  const problems: KatexProblem[] = [];

  for (const segment of segments) {
    if (problems.length >= MAX_PROBLEMS) break;
    try {
      katex.renderToString(segment.source, {
        throwOnError: true,
        displayMode: segment.displayMode,
        output: 'html',
        trust: false,
      });
    } catch (error) {
      problems.push({
        kind: 'parse',
        source: segment.source,
        displayMode: segment.displayMode,
        start: segment.start,
        message: messageOf(error),
      });
    }
  }

  for (const segment of unterminated) {
    if (problems.length >= MAX_PROBLEMS) break;
    problems.push({
      kind: 'unterminated',
      source: segment.source,
      displayMode: true,
      start: segment.start,
      message: 'Rumus blok dibuka dengan $$ tetapi belum ditutup.',
    });
  }

  return problems.length > 0 ? { ok: false, segments, problems } : { ok: true, segments };
}

/** Satu baris Bahasa Indonesia yang siap ditampilkan atau dikirim balik ke klien. */
export function describeKatexProblem(problem: KatexProblem): string {
  if (problem.kind === 'unterminated') {
    return `Rumus blok "$${truncateSource(problem.source)}" belum ditutup dengan $$.`;
  }
  return `KaTeX belum bisa membaca rumus "${truncateSource(problem.source)}". Periksa kembali tanda kurungnya.`;
}
