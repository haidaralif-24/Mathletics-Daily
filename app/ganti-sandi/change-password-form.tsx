'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changePassword } from '@/lib/actions/auth';
import { cn } from '@/lib/utils';
import { changePasswordSchema, type ChangePasswordInput } from '@/lib/validation';

const FIELD_WITH_ERROR = 'border-destructive aria-invalid:ring-destructive/20';

/**
 * A-3 / A-7. On success the action cleared `must_change_password` in both places
 * and refreshed the session, so a plain navigation works — proxy.ts no longer
 * sends the member back here.
 */
export function ChangePasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await changePassword(values);

      if (!result.ok) {
        for (const [field, messages] of Object.entries(result.error.fieldErrors ?? {})) {
          if (field === 'password' || field === 'confirmPassword') {
            setError(field, { message: messages[0] });
          }
        }
        if (!result.error.fieldErrors) setError('root', { message: result.error.message });
        else toast.error(result.error.message);
        return;
      }

      if (result.data.relogin) {
        // The password is saved, but the session could not pick up the new JWT
        // flag; signing in again gives the member a clean session.
        toast.success('Kata sandi tersimpan. Masuk lagi dengan kata sandi baru.');
        router.replace('/login');
        return;
      }

      toast.success('Kata sandi berhasil diganti.');
      router.replace('/');
      router.refresh();
    });
  });

  const formError = errors.root?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Kata sandi baru</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? 'password-error' : 'password-hint'}
          className={cn('h-11', errors.password && FIELD_WITH_ERROR)}
          {...register('password')}
        />
        {errors.password ? (
          <p id="password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        ) : (
          <p id="password-hint" className="text-xs text-muted-foreground">
            Minimal 8 karakter.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">Ulangi kata sandi baru</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.confirmPassword ? true : undefined}
          aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
          className={cn('h-11', errors.confirmPassword && FIELD_WITH_ERROR)}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword ? (
          <p id="confirm-password-error" className="text-sm text-destructive">
            {errors.confirmPassword.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending} aria-busy={pending}>
        {pending ? 'Menyimpan...' : 'Simpan kata sandi'}
      </Button>
    </form>
  );
}
