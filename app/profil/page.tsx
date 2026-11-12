import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { requireUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { SignOutButton } from './sign-out-button';

export const metadata: Metadata = { title: 'Profil' };

/**
 * A-7 / decision 18: name and class are admin-managed and read-only here.
 * Members have no write on `profiles` (docs/SECURITY.md), so the screen shows
 * the values and links to the password change instead of offering an edit form.
 */
export default function ProfilPage() {
  return (
    <section className="flex flex-col gap-6" aria-labelledby="judul-profil">
      <header className="flex flex-col gap-2">
        <h1 id="judul-profil" className="font-heading text-2xl font-semibold tracking-tight">
          Profil
        </h1>
        <p className="text-sm text-muted-foreground">
          Data akunmu di klub. Nama dan kelas diatur admin.
        </p>
      </header>

      <Suspense fallback={<ProfilSkeleton />}>
        <ProfilCard />
      </Suspense>
    </section>
  );
}

function ProfilSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Memuat profil">
      <CardHeader>
        <Skeleton className="h-5 w-24" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-11 w-full" />
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
      <dt className="text-sm text-muted-foreground sm:w-28">{label}</dt>
      <dd className="text-sm font-medium break-words text-foreground">{value}</dd>
    </div>
  );
}

async function ProfilCard() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Data akun</CardTitle>
          <CardDescription>
            Nama dan kelas diatur admin klub dan tidak bisa kamu ubah sendiri.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-3">
            <Field label="Nama" value={user.displayName} />
            <Field
              label="Kelas"
              value={user.className && user.className.length > 0 ? user.className : 'Belum diisi admin'}
            />
            <Field label="Email" value={user.email} />
            <Field label="Peran" value={user.role === 'admin' ? 'Admin' : 'Anggota'} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kata sandi</CardTitle>
          <CardDescription>
            Ganti kata sandimu kapan saja. Minimal 8 karakter dan hanya kamu yang tahu.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link
            href="/ganti-sandi"
            className={cn(buttonVariants({ variant: 'outline' }), 'h-11 w-full px-4 sm:w-fit')}
          >
            Ganti kata sandi
          </Link>
          <p className="text-xs text-muted-foreground">
            Nama atau kelas salah? Hubungi admin klub, ya.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keluar</CardTitle>
          <CardDescription>
            Keluar dari akun ini di perangkat yang kamu pakai. Kamu bisa masuk lagi kapan saja.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}
