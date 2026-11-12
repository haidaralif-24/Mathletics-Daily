'use client';

import { useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ImageOffIcon,
  RotateCcwIcon,
  RotateCwIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { GradingPhoto } from './types';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

interface PhotoViewerProps {
  photos: GradingPhoto[];
  /** Index of the photo to open first. */
  startIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * R-2: photos open full size with zoom and rotate, so handwritten steps stay
 * readable. The dialog keeps the admin on the same screen (R-4) — photos never
 * navigate away.
 *
 * The parent remounts this component (through a `key`) every time a photo is
 * opened, so zoom and rotation always start clean without an effect.
 */
export function PhotoViewer({ photos, startIndex, open, onOpenChange }: PhotoViewerProps) {
  const [index, setIndex] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [failed, setFailed] = useState(false);

  const photo = photos[index];
  const total = photos.length;
  const clampZoom = (value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));

  const goTo = (nextIndex: number) => {
    setIndex(nextIndex);
    setZoom(1);
    setRotation(0);
    setFailed(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Foto langkah pengerjaan {index + 1} dari {total}
          </DialogTitle>
          <DialogDescription>
            Perbesar atau putar foto supaya tulisan tangan terbaca. Tekan Esc untuk menutup.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] place-items-center overflow-auto rounded-lg bg-muted p-2">
          {photo && photo.url && !failed ? (
            // Signed, short-lived URL for a private bucket: it must not go through
            // the image optimiser (which would outlive the signature).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.url}
              alt={`Foto langkah pengerjaan ${index + 1} dari ${total}`}
              onError={() => setFailed(true)}
              className="max-h-[56vh] w-auto max-w-full origin-center transition-transform duration-150"
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <ImageOffIcon aria-hidden="true" className="size-6" />
              <p>Foto tidak dapat dimuat. Muat ulang kiriman untuk mencoba lagi.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11"
            onClick={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}
            aria-label="Perkecil foto"
          >
            <ZoomOutIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11"
            onClick={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}
            aria-label="Perbesar foto"
          >
            <ZoomInIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11"
            onClick={() => setRotation((value) => value - 90)}
            aria-label="Putar foto ke kiri"
          >
            <RotateCcwIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11"
            onClick={() => setRotation((value) => value + 90)}
            aria-label="Putar foto ke kanan"
          >
            <RotateCwIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={() => {
              setZoom(1);
              setRotation(0);
            }}
          >
            Reset
          </Button>

          {total > 1 ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => goTo((index - 1 + total) % total)}
              >
                <ChevronLeftIcon aria-hidden="true" />
                Sebelumnya
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => goTo((index + 1) % total)}
              >
                Berikutnya
                <ChevronRightIcon aria-hidden="true" />
              </Button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
