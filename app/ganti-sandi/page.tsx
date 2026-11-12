import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getSessionUser } from '@/lib/auth';
import { ChangePasswordForm } from './change-password-form';

export const metadata: Metadata = { title: 'Ubah Kata Sandi' };

/**
 * A-3 (forced at first login) and A-7 (reachable from Profil).
 * Reading the session is request-time data, so it sits behind <Suspense>.
 */
export default function ChangePasswordPage() {
  return (
    <section
      className="mx-auto flex w-full max-w-sm flex-col gap-6 py-2"
      aria-labelledby="judul-ganti-sandi"
    >
      <header className="flex flex-col gap-2">
        <h1 id="judul-ganti-sandi" className="font-heading text-2xl font-semibold tracking-tight">
          Ubah Kata Sandi
        </h1>
        <p className="text-sm text-muted-foreground">
          Minimal 8 karakter. Jangan bagikan kata sandimu ke siapa pun, termasuk ke admin.
        </p>
      </header>

      <Suspense fallback={<ChangePasswordSkeleton />}>
        <ChangePasswordGate />
      </Suspense>
    </section>
  );
}

function ChangePasswordSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Memuat formulir kata sandi">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-11 w-full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-11 w-full" />
      </div>
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

async function ChangePasswordGate() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!user.active) redirect('/login?nonaktif=1');

  return (
    <div className="flex flex-col gap-4">
      {user.mustChangePassword ? (
        <div role="status" className="rounded-lg border border-primary/30 bg-secondary px-3 py-2 text-sm">
          <p className="font-medium text-secondary-foreground">Ganti kata sandi sementara dulu</p>
          <p className="mt-0.5 text-muted-foreground">
            Admin membuatkan kata sandi sementara untukmu. Ganti sekarang supaya kamu bisa lanjut ke
            soal hari ini.
          </p>
        </div>
      ) : null}
      <ChangePasswordForm />
    </div>
  );
}
