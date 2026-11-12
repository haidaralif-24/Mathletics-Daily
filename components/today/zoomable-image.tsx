'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ZoomIn } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * S-4: the optional diagram, zoomable on a phone. The thumbnail opens a dialog
 * with the full-size image instead of navigating away.
 *
 * Objects live in a private bucket, so `src` is a short-lived signed URL; it is
 * served with `unoptimized` because the optimizer cannot be pointed at a
 * signed, per-request URL.
 */
export function ZoomableImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(
          'group relative block w-full overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10 outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50',
          className,
        )}
        aria-label={`Perbesar gambar: ${alt}`}
      >
        <Image
          src={src}
          alt={alt}
          width={1200}
          height={800}
          unoptimized
          className="h-auto max-h-80 w-full object-contain"
        />
        <span className="pointer-events-none absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-medium text-foreground ring-1 ring-foreground/10">
          <ZoomIn className="size-3.5" aria-hidden="true" />
          Perbesar
        </span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogTitle>{alt}</DialogTitle>
        <DialogDescription className="sr-only">
          Gambar diperbesar. Tekan Esc atau tombol tutup untuk kembali.
        </DialogDescription>
        <Image
          src={src}
          alt={alt}
          width={1600}
          height={1200}
          unoptimized
          className="h-auto max-h-[75vh] w-full object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
