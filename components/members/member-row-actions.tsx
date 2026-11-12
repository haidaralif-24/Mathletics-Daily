'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ActionResult } from '@/lib/actions/result';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  deactivateMember,
  resetPassword,
  setMemberRole,
  updateMember,
} from '@/lib/actions/members';
import { updateMemberSchema } from '@/lib/validation';
import { TempPasswordPanel } from './temp-password-panel';
import type { MemberRow } from './types';

type DialogKind = 'edit' | 'role' | 'active' | 'reset' | null;

/**
 * U-2: per-member actions. Every one of them re-checks `requireAdmin()` on the
 * server, so hiding a button here is only about clarity, never about safety.
 * An admin cannot demote or deactivate themselves (the action refuses), hence
 * the self row shows fewer buttons.
 */
export function MemberRowActions({
  member,
  isSelf,
}: {
  member: MemberRow;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [displayName, setDisplayName] = useState(member.displayName);
  const [className, setClassName] = useState(member.className ?? '');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const close = () => {
    setDialog(null);
    setFieldError(null);
  };

  const openEdit = () => {
    setDisplayName(member.displayName);
    setClassName(member.className ?? '');
    setFieldError(null);
    setDialog('edit');
  };

  const openReset = () => {
    setTemporaryPassword(null);
    setFieldError(null);
    setDialog('reset');
  };

  const openRole = () => {
    setFieldError(null);
    setDialog('role');
  };

  const run = (work: () => Promise<ActionResult<undefined>>, success: string) => {
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(success);
      router.refresh();
      close();
    });
  };

  const saveEdit = () => {
    const parsed = updateMemberSchema.safeParse({
      userId: member.id,
      displayName,
      className: className.trim().length > 0 ? className.trim() : null,
    });

    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Periksa kembali isiannya.');
      return;
    }

    run(() => updateMember(parsed.data), 'Data anggota tersimpan.');
  };

  const saveRole = () => {
    const role = member.role === 'admin' ? 'member' : 'admin';
    run(
      () => setMemberRole({ userId: member.id, role }),
      role === 'admin' ? 'Anggota dijadikan admin.' : 'Peran dikembalikan ke anggota.',
    );
  };

  const saveActive = () => {
    const active = !member.active;
    run(
      () => deactivateMember({ userId: member.id, active }),
      active ? 'Akun diaktifkan lagi.' : 'Akun dinonaktifkan.',
    );
  };

  const saveReset = () => {
    startTransition(async () => {
      const result = await resetPassword({ userId: member.id });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setTemporaryPassword(result.data.temporaryPassword);
      toast.success('Kata sandi sementara dibuat.');
      router.refresh();
    });
  };

  const actionClass = 'h-11 px-3 sm:h-9';

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className={actionClass} onClick={openEdit}>
          Edit
        </Button>
        <Button type="button" variant="outline" size="sm" className={actionClass} onClick={openReset}>
          Reset sandi
        </Button>
        {/* An admin cannot demote or deactivate themselves, so their own row hides both. */}
        {isSelf ? null : (
          <>
            <Button type="button" variant="outline" size="sm" className={actionClass} onClick={openRole}>
              {member.role === 'admin' ? 'Jadikan anggota' : 'Jadikan admin'}
            </Button>
            <Button
              type="button"
              variant={member.active ? 'destructive' : 'outline'}
              size="sm"
              className={actionClass}
              onClick={() => setDialog('active')}
            >
              {member.active ? 'Nonaktifkan' : 'Aktifkan'}
            </Button>
          </>
        )}
      </div>

      <Dialog open={dialog === 'edit'} onOpenChange={(open) => (open ? setDialog('edit') : close())}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Edit data anggota</DialogTitle>
            <DialogDescription>
              {member.email}. Nama dan kelas diatur admin (anggota tidak bisa mengubahnya sendiri).
            </DialogDescription>
          </DialogHeader>

          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              saveEdit();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor={`nama-${member.id}`}>Nama</Label>
              <Input
                id={`nama-${member.id}`}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="h-11"
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? `nama-error-${member.id}` : undefined}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`kelas-${member.id}`}>Kelas</Label>
              <Input
                id={`kelas-${member.id}`}
                value={className}
                onChange={(event) => setClassName(event.target.value)}
                placeholder="7A"
                className="h-11"
              />
            </div>

            {fieldError ? (
              <p id={`nama-error-${member.id}`} role="alert" className="text-sm text-destructive">
                {fieldError}
              </p>
            ) : null}

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" size="lg" className="h-11 px-4" />}>
                Batal
              </DialogClose>
              <Button type="submit" size="lg" className="h-11 px-4" disabled={pending} aria-busy={pending}>
                {pending ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'role'} onOpenChange={(open) => (open ? setDialog('role') : close())}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {member.role === 'admin' ? 'Kembalikan jadi anggota?' : 'Jadikan admin?'}
            </DialogTitle>
            <DialogDescription>
              {member.role === 'admin'
                ? `${member.displayName} tidak akan bisa membuka menu admin lagi.`
                : `${member.displayName} akan bisa menulis soal, menilai jawaban, dan mengelola anggota.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" size="lg" className="h-11 px-4" />}>
              Batal
            </DialogClose>
            <Button
              type="button"
              size="lg"
              className="h-11 px-4"
              disabled={pending}
              aria-busy={pending}
              onClick={saveRole}
            >
              {pending ? 'Menyimpan...' : 'Lanjutkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'active'} onOpenChange={(open) => (open ? setDialog('active') : close())}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{member.active ? 'Nonaktifkan akun?' : 'Aktifkan akun lagi?'}</DialogTitle>
            <DialogDescription>
              {member.active
                ? `${member.displayName} tidak bisa masuk atau mengirim jawaban, dan hilang dari papan peringkat. Datanya tetap tersimpan.`
                : `${member.displayName} bisa masuk lagi dan kembali muncul di papan peringkat.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" size="lg" className="h-11 px-4" />}>
              Batal
            </DialogClose>
            <Button
              type="button"
              variant={member.active ? 'destructive' : 'default'}
              size="lg"
              className="h-11 px-4"
              disabled={pending}
              aria-busy={pending}
              onClick={saveActive}
            >
              {pending ? 'Menyimpan...' : member.active ? 'Nonaktifkan' : 'Aktifkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'reset'} onOpenChange={(open) => (open ? setDialog('reset') : close())}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Reset kata sandi</DialogTitle>
            <DialogDescription>
              {temporaryPassword
                ? 'Bagikan kata sandi ini ke anggota. Dia wajib menggantinya saat masuk.'
                : `Kata sandi lama ${member.displayName} tidak berlaku lagi. Kata sandi baru tampil sekali.`}
            </DialogDescription>
          </DialogHeader>

          {temporaryPassword ? (
            <TempPasswordPanel
              rows={[
                {
                  email: member.email,
                  displayName: member.displayName,
                  className: member.className,
                  temporaryPassword,
                },
              ]}
              heading="Kata sandi baru"
            />
          ) : null}

          <DialogFooter>
            {temporaryPassword ? (
              <DialogClose render={<Button type="button" size="lg" className="h-11 px-4" />}>
                Selesai
              </DialogClose>
            ) : (
              <>
                <DialogClose render={<Button type="button" variant="outline" size="lg" className="h-11 px-4" />}>
                  Batal
                </DialogClose>
                <Button
                  type="button"
                  size="lg"
                  className="h-11 px-4"
                  disabled={pending}
                  aria-busy={pending}
                  onClick={saveReset}
                >
                  {pending ? 'Membuat...' : 'Buat kata sandi baru'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
