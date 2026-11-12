/**
 * Re-export shim. The renderer now lives in `components/math/math-markdown.tsx`
 * so the member pages and the admin editor preview cannot drift apart
 * (docs/DECISIONS.md 28). Import `@/components/math/math-markdown` directly in
 * new code.
 */
export { MathMarkdown } from '@/components/math/math-markdown';
