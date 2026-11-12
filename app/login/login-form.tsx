'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn } from '@/lib/actions/auth';
import { cn } from '@/lib/utils';
import { signInSchema, type SignInInput } from '@/lib/validation';

const FIELD_WITH_ERROR = 'border-destructive aria-invalid:ring-destructive/20';

/**
 * A-1 + A-6: the password never leaves this component; it goes straight to the
 * `signIn` server action. Every failure shows the same generic message, so the
 * form never reveals whether an email exists.
 */
export function LoginForm({ next }: { next: string }) {
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await signIn({ ...values, next });
      // On success the action redirects, so there is nothing to handle here.
      if (result.ok) return;

      for (const [field, messages] of Object.entries(result.error.fieldErrors ?? {})) {
        if (field === 'email' || field === 'password') {
          setError(field, { message: messages[0] });
        }
      }
      if (!result.error.fieldErrors) {
        setError('root', { message: result.error.message });
      }
    });
  });

  const formError = errors.root?.message;

  return (
    // method="post" is deliberate: without it, a submit that lands before React
    // hydrates (or with JS off) is a native GET and puts the email AND the
    // password in the URL, the browser history and the server access log.
    // The app needs JS to sign in anyway, so a no-JS POST returning 405 is fine.
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="nama@contoh.com"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className={cn('h-11', errors.email && FIELD_WITH_ERROR)}
          {...register('email')}
        />
        {errors.email ? (
          <p id="email-error" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Kata sandi</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? 'password-error' : undefined}
          className={cn('h-11', errors.password && FIELD_WITH_ERROR)}
          {...register('password')}
        />
        {errors.password ? (
          <p id="password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending} aria-busy={pending}>
        {pending ? 'Memeriksa...' : 'Masuk'}
      </Button>
    </form>
  );
}
