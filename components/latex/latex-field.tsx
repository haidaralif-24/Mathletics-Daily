'use client';

import { useDeferredValue, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MathMarkdown } from './math-markdown';
import { MathToolbar } from './math-toolbar';
import { checkKatexText, describeKatexProblem } from './katex-check';

/**
 * Satu kolom teks ber-LaTeX: label, toolbar placeholder, textarea, pemeriksaan
 * KaTeX, dan pratinjau langsung (Q-1).
 *
 * Pemeriksaan di sini hanya untuk UX — penjaga sesungguhnya ada di server
 * action (`lib/actions/questions.ts`), yang memakai fungsi yang sama.
 */
export interface LatexFieldProps {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  /** Tampilkan toolbar placeholder rumus. */
  withToolbar?: boolean;
  /** Tampilkan pratinjau hasil render. */
  withPreview?: boolean;
  /** Pesan dari server; menang atas hasil pemeriksaan klien. */
  error?: string | null;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
}

export function LatexField({
  id,
  label,
  hint,
  value,
  onChange,
  rows = 8,
  placeholder,
  withToolbar = false,
  withPreview = false,
  error,
  maxLength,
  disabled,
  className,
}: LatexFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const fieldId = id;

  // Nilai yang ditunda: mengetik tetap mulus walau rumusnya panjang.
  const deferred = useDeferredValue(value);
  const problem = useMemo(() => {
    const result = checkKatexText(deferred);
    return result.ok ? null : describeKatexProblem(result.problems[0]);
  }, [deferred]);

  const message = error?.trim() ? error : problem;
  const describedBy = [hint ? hintId : null, message ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <Label htmlFor={fieldId}>{label}</Label>
        {maxLength ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {value.length}/{maxLength}
          </span>
        ) : null}
      </div>

      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {withToolbar ? (
        <MathToolbar
          textareaRef={textareaRef}
          onValueChange={onChange}
          disabled={disabled}
          className="rounded-lg border border-border bg-card p-1.5"
        />
      ) : null}

      <Textarea
        id={fieldId}
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="min-w-0 font-mono text-sm"
      />

      {message ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {message}
        </p>
      ) : null}

      {withPreview ? (
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">Pratinjau</p>
          <div className="min-w-0 max-w-full overflow-x-auto rounded-lg border border-input bg-muted/40 p-3">
            {deferred.trim() ? (
              <MathMarkdown>{deferred}</MathMarkdown>
            ) : (
              <p className="text-sm text-muted-foreground">
                Pratinjau soal muncul di sini begitu kamu menulis.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
