'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/actions/auth';

/** Signs the member out through the server action, then the action redirects. */
export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="h-11 w-full px-4 sm:w-fit"
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        startTransition(async () => {
          await signOut();
        });
      }}
    >
      {pending ? 'Keluar...' : 'Keluar dari akun'}
    </Button>
  );
}
