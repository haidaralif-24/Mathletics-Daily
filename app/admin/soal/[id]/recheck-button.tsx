'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { recheckQuestionVerdicts } from '@/lib/actions/recheck';

/**
 * SPEC section 6, "Wrong key published": fix the key, re-run the auto-check,
 * admin re-confirms affected grades.
 *
 * Deliberately on the question editor rather than the grading screen: this is
 * something an admin does immediately after correcting a key, and it keeps the
 * grading screen out of the blast radius. The action re-checks `requireAdmin()`.
 */
export function RecheckButton({ questionId, submissionCount }: { questionId: string; submissionCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (submissionCount === 0) return null;

  const run = () => {
    startTransition(async () => {
      const result = await recheckQuestionVerdicts({ questionId });

      if (!result.ok) {
        toast.error(result.error.message);
        setOpen(false);
        return;
      }

      const { checked, changed } = result.data;
      if (changed === 0) {
        toast.success(`Tebakan otomatis ${checked} kiriman sudah sesuai kunci yang sekarang.`);
      } else {
        toast.success(
          `${changed} dari ${checked} kiriman berubah. Nilai yang sudah tersimpan ditandai perlu dinilai ulang.`,
        );
      }

      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button type="button" variant="outline" className="min-h-11 w-fit px-4" onClick={() => setOpen(true)}>
        Hitung ulang tebakan otomatis
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hitung ulang tebakan otomatis?</DialogTitle>
            <DialogDescription>
              Tebakan Benar/Salah dihitung ulang untuk {submissionCount} kiriman memakai kunci jawaban yang
              tersimpan sekarang. Nilai yang sudah kamu simpan tidak berubah, tetapi kiriman yang tebakannya
              berubah akan ditandai <strong>perlu dinilai ulang</strong> supaya kamu bisa memeriksanya.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" className="min-h-11" />}>
              Batal
            </DialogClose>
            <Button type="button" className="min-h-11" disabled={pending} onClick={run}>
              {pending ? 'Menghitung…' : 'Hitung ulang'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
