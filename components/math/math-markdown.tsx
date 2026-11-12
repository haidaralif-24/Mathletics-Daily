import type { Components } from 'react-markdown';
import Markdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { cn } from '@/lib/utils';

/**
 * The ONE markdown + KaTeX renderer for the whole app: question bodies,
 * solutions, mark schemes and the admin editor preview all come through here,
 * so what an admin previews is what a member sees.
 *
 * TANPA `rehype-raw` (AGENTS.md aturan keras 6): HTML mentah di dalam teks soal
 * diperlakukan sebagai teks biasa dan tidak pernah dirender.
 *
 * Rumus panjang menggeser mendatar di dalam bloknya sendiri, jadi tidak pernah
 * merusak tata letak di layar 360 px (docs/UI_GUIDE.md "Math rendering").
 * Teks 16 px di ponsel.
 *
 * Historical note: `components/today/markdown.tsx` and
 * `components/latex/math-markdown.tsx` were two separate copies written by
 * different agents; both now re-export this file (docs/DECISIONS.md 28).
 */

const components: Components = {
  p: (props) => <p className="my-2 leading-relaxed break-words">{props.children}</p>,
  h1: (props) => <h2 className="mt-4 mb-2 font-heading text-lg font-semibold">{props.children}</h2>,
  h2: (props) => <h3 className="mt-4 mb-2 font-heading text-base font-semibold">{props.children}</h3>,
  h3: (props) => <h4 className="mt-3 mb-1.5 font-heading text-sm font-semibold">{props.children}</h4>,
  ul: (props) => <ul className="my-2 list-disc space-y-1 pl-5">{props.children}</ul>,
  ol: (props) => <ol className="my-2 list-decimal space-y-1 pl-5">{props.children}</ol>,
  li: (props) => <li className="break-words">{props.children}</li>,
  strong: (props) => <strong className="font-semibold">{props.children}</strong>,
  em: (props) => <em className="italic">{props.children}</em>,
  hr: () => <hr className="my-3 border-border" />,
  blockquote: (props) => (
    <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
      {props.children}
    </blockquote>
  ),
  code: (props) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{props.children}</code>
  ),
  pre: (props) => (
    <pre className="my-2 max-w-full overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
      {props.children}
    </pre>
  ),
  a: (props) => (
    <a
      href={props.href}
      className="text-primary underline underline-offset-4"
      rel="noreferrer noopener"
      target="_blank"
    >
      {props.children}
    </a>
  ),
};

export function MathMarkdown({
  children,
  className,
}: {
  /** Teks markdown + LaTeX. String kosong menghasilkan paragraf kosong. */
  children: string;
  className?: string;
}) {
  return (
    <div
      data-slot="math-markdown"
      className={cn(
        // `min-w-0` + overflow hanya pada blok rumus: rumus panjang menggeser
        // mendatar di dalam kotaknya sendiri, bukan melebarkan halaman.
        'min-w-0 max-w-full text-base break-words text-foreground',
        '[&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1',
        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className,
      )}
    >
      <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
        {children}
      </Markdown>
    </div>
  );
}
