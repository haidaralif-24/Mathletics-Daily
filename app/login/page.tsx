import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getSessionUser } from '@/lib/auth';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Masuk' };

type LoginSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * A-1: email + password, submitted through the `signIn` server action so
 * Supabase Auth's built-in rate limit applies. There is no signup page.
 *
 * The session read and `searchParams` are request-time data (cacheComponents
 * is on), so they live in a child inside <Suspense>; the heading stays static.
 */
export default function LoginPage({ searchParams }: { searchParams: LoginSearchParams }) {
  return (
    <section
      className="mx-auto flex w-full max-w-sm flex-col gap-6 py-2"
      aria-labelledby="judul-masuk"
    >
      <header className="flex flex-col gap-2">
        <h1 id="judul-masuk" className="font-heading text-2xl font-semibold tracking-tight">
          Masuk
        </h1>
        <p className="text-sm text-muted-foreground">
          Pakai email dan kata sandi yang diberikan admin klub. Akun dibuat oleh admin, jadi
          tidak ada pendaftaran sendiri.
        </p>
      </header>

      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginGate searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Memuat formulir masuk">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-11 w-full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-11 w-full" />
      </div>
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

/** Sends signed-in members on their way instead of showing the form again. */
async function LoginGate({ searchParams }: { searchParams: LoginSearchParams }) {
  const params = await searchParams;
  const user = await getSessionUser();

  if (user?.active) {
    // A-3: the forced password change comes first, whatever `?next=` says.
    if (user.mustChangePassword) redirect('/ganti-sandi');
    redirect(readNextPath(params));
  }

  return (
    <div className="flex flex-col gap-4">
      {params.nonaktif ? <InactiveNotice /> : null}
      <LoginForm next={readNextPath(params)} />
      <p className="text-xs text-muted-foreground">
        Lupa kata sandi? Minta admin klub mengatur ulang; kata sandi baru akan muncul sekali.
      </p>
    </div>
  );
}

/** A `?next=` value must stay inside this app (`//evil.example` is an open redirect). */
function readNextPath(params: Record<string, string | string[] | undefined>): string {
  const raw = params.next;
  const next = Array.isArray(raw) ? raw[0] : raw;
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  return next;
}

/** Shown when proxy.ts sends a deactivated member here with `?nonaktif=1` (A-5). */
function InactiveNotice() {
  return (
    <div
      role="status"
      className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >
      <p className="font-medium">Akun ini dinonaktifkan</p>
      <p className="mt-0.5 text-danger/90">
        Kamu tidak bisa masuk untuk sementara. Hubungi admin klub kalau menurutmu ini keliru.
      </p>
    </div>
  );
}
