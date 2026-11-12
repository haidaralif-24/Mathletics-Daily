'use client';

import type { RefObject } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { buildInsertion } from './insert';
import { TEMPLATE_GROUPS, templatesInGroup, type LatexTemplate } from './templates';

/**
 * Toolbar placeholder rumus (Q-1). Setiap tombol menyisipkan di posisi kursor
 * asli textarea, atau membungkus teks yang sedang dipilih — bukan menempel di
 * akhir teks.
 *
 * `setRangeText` dipakai supaya riwayat undo bawaan peramban tetap jalan, dan
 * supaya React tidak menghapus pilihan teks saat tombol ditekan (karena itu
 * `onMouseDown` dicegah default-nya).
 */
interface MathToolbarProps {
  /** Textarea tujuan; posisi kursor dibaca langsung dari DOM. */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** Dipanggil dengan isi textarea terbaru setelah penyisipan. */
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Menyelaraskan pelacak nilai React dengan nilai DOM yang diubah `setRangeText`. */
function syncTrackedValue(element: HTMLTextAreaElement, next: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  if (descriptor?.set) descriptor.set.call(element, next);
  else element.value = next;
}

export function MathToolbar({ textareaRef, onValueChange, disabled, className }: MathToolbarProps) {
  function handleTemplate(template: LatexTemplate): void {
    const element = textareaRef.current;
    if (!element) return;

    // Baca pilihan lebih dulu: memfokuskan elemen di iOS bisa mereset kursor.
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    const result = buildInsertion(template, element.value, start, end);

    element.focus();

    if (typeof element.setRangeText === 'function') {
      element.setRangeText(result.replacement, start, end, 'end');
      element.setSelectionRange(result.caret, result.caret);
      syncTrackedValue(element, result.value);
    } else {
      element.value = result.value;
      element.setSelectionRange(result.caret, result.caret);
    }

    onValueChange(result.value);
  }

  return (
    <div
      role="group"
      aria-label="Alat rumus LaTeX"
      className={cn('flex flex-wrap items-center gap-1', className)}
    >
      {TEMPLATE_GROUPS.map((group) => (
        <div
          key={group.id}
          role="group"
          aria-label={group.label}
          className="flex flex-wrap items-center gap-1"
        >
          {templatesInGroup(group.id).map((template) => (
            <Button
              key={template.id}
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled}
              className="size-11 shrink-0 font-heading"
              aria-label={template.ariaLabel}
              title={template.ariaLabel}
              data-latex-template={template.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleTemplate(template)}
            >
              <span aria-hidden="true" className="text-sm">
                {template.label}
              </span>
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
