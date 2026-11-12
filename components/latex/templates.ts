/**
 * Placeholder toolbar untuk editor LaTeX (Q-1): pecahan, akar, pangkat, indeks,
 * sigma, kombinasi, sudut, huruf Yunani, serta rumus inline dan blok.
 *
 * Setiap tombol hanya menyisipkan teks di posisi kursor / membungkus pilihan
 * teks (lihat `buildInsertion`). Tidak ada rumus yang dirender di sini.
 *
 * Aturan caret saat TIDAK ada pilihan teks: kursor mendarat di `caret` (default
 * tepat setelah `before`, artinya di dalam kurung kurawal). Kalau ada pilihan
 * teks, pilihan itu dibungkus `before` + pilihan + `after` dan kursor pindah ke
 * ujungnya.
 */

export type TemplateGroupId = 'dasar' | 'lanjutan' | 'yunani' | 'rumus';

export interface LatexTemplate {
  id: string;
  /** Label singkat di tombol. */
  label: string;
  /** Nama aksesibel; tombol ikon wajib punya label (docs/UI_GUIDE.md). */
  ariaLabel: string;
  before: string;
  after: string;
  /** Offset caret di dalam `before + after` saat tidak ada pilihan teks. */
  caret?: number;
  group: TemplateGroupId;
}

export const TEMPLATE_GROUPS: ReadonlyArray<{ id: TemplateGroupId; label: string }> = [
  { id: 'dasar', label: 'Dasar' },
  { id: 'lanjutan', label: 'Lanjutan' },
  { id: 'yunani', label: 'Huruf Yunani' },
  { id: 'rumus', label: 'Rumus' },
];

export const LATEX_TEMPLATES: ReadonlyArray<LatexTemplate> = [
  // Dasar
  {
    id: 'fraction',
    label: 'a/b',
    ariaLabel: 'Sisipkan pecahan (\\frac{}{})',
    before: '\\frac{',
    after: '}{}',
    group: 'dasar',
  },
  {
    id: 'root',
    label: '√',
    ariaLabel: 'Sisipkan akar (\\sqrt{})',
    before: '\\sqrt{',
    after: '}',
    group: 'dasar',
  },
  {
    id: 'power',
    label: 'x²',
    ariaLabel: 'Sisipkan pangkat (^{})',
    before: '^{',
    after: '}',
    group: 'dasar',
  },
  {
    id: 'subscript',
    label: 'x₂',
    ariaLabel: 'Sisipkan indeks bawah (_{})',
    before: '_{',
    after: '}',
    group: 'dasar',
  },

  // Lanjutan
  {
    id: 'sum',
    label: 'Σ',
    ariaLabel: 'Sisipkan notasi sigma (\\sum_{i=1}^{n})',
    before: '\\sum_{i=1}^{n} ',
    after: '',
    group: 'lanjutan',
  },
  {
    id: 'binom',
    label: 'ⁿCₖ',
    ariaLabel: 'Sisipkan koefisien binomial (\\binom{}{})',
    before: '\\binom{',
    after: '}{}',
    group: 'lanjutan',
  },
  {
    id: 'angle',
    label: '∠',
    ariaLabel: 'Sisipkan tanda sudut (\\angle)',
    before: '\\angle ',
    after: '',
    group: 'lanjutan',
  },
  {
    id: 'degree',
    label: '°',
    ariaLabel: 'Sisipkan derajat (^{\\circ})',
    before: '^{\\circ}',
    after: '',
    group: 'lanjutan',
  },

  // Huruf Yunani
  { id: 'alpha', label: 'α', ariaLabel: 'Sisipkan alfa (\\alpha)', before: '\\alpha ', after: '', group: 'yunani' },
  { id: 'beta', label: 'β', ariaLabel: 'Sisipkan beta (\\beta)', before: '\\beta ', after: '', group: 'yunani' },
  { id: 'gamma', label: 'γ', ariaLabel: 'Sisipkan gama (\\gamma)', before: '\\gamma ', after: '', group: 'yunani' },
  { id: 'theta', label: 'θ', ariaLabel: 'Sisipkan teta (\\theta)', before: '\\theta ', after: '', group: 'yunani' },
  { id: 'pi', label: 'π', ariaLabel: 'Sisipkan pi (\\pi)', before: '\\pi ', after: '', group: 'yunani' },
  { id: 'lambda', label: 'λ', ariaLabel: 'Sisipkan lambda (\\lambda)', before: '\\lambda ', after: '', group: 'yunani' },
  { id: 'mu', label: 'μ', ariaLabel: 'Sisipkan mu (\\mu)', before: '\\mu ', after: '', group: 'yunani' },
  { id: 'sigma', label: 'σ', ariaLabel: 'Sisipkan sigma (\\sigma)', before: '\\sigma ', after: '', group: 'yunani' },
  { id: 'delta', label: 'Δ', ariaLabel: 'Sisipkan delta besar (\\Delta)', before: '\\Delta ', after: '', group: 'yunani' },
  { id: 'omega', label: 'Ω', ariaLabel: 'Sisipkan omega besar (\\Omega)', before: '\\Omega ', after: '', group: 'yunani' },

  // Rumus inline dan blok
  {
    id: 'inline-math',
    label: '$…$',
    ariaLabel: 'Bungkus dengan rumus inline ($...$)',
    before: '$',
    after: '$',
    group: 'rumus',
  },
  {
    id: 'block-math',
    label: '$$…$$',
    ariaLabel: 'Sisipkan rumus blok ($$...$$)',
    before: '$$\n',
    after: '\n$$',
    group: 'rumus',
  },
];

export const templatesInGroup = (group: TemplateGroupId): LatexTemplate[] =>
  LATEX_TEMPLATES.filter((template) => template.group === group);
