import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ImportMembersForm } from '@/components/members/import-members-form';
import { MemberList, MemberListSkeleton } from './member-list';

export const metadata: Metadata = { title: 'Kelola Member' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * U-1 / U-2: import the roster, then edit, promote, reset or deactivate members.
 * The admin guard lives in `app/admin/layout.tsx` (`requireAdmin()`), and every
 * action re-checks it before touching the service-role client.
 *
 * The member list reads `searchParams` and the database, so it streams in behind
 * <Suspense>; the heading and the import form are part of the static shell.
 */
export default function AdminMemberPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <section className="flex flex-col gap-6" aria-labelledby="judul-member">
      <header className="flex flex-col gap-2">
        <h1 id="judul-member" className="font-heading text-2xl font-semibold tracking-tight">
          Kelola Member
        </h1>
        <p className="text-sm text-muted-foreground">
          Impor daftar siswa, perbaiki nama dan kelas, reset kata sandi, atau nonaktifkan akun yang
          sudah tidak ikut.
        </p>
      </header>

      <Suspense fallback={<MemberListSkeleton />}>
        <MemberList searchParams={searchParams} />
      </Suspense>

      {/* No runtime data here, so the import form is part of the static shell. */}
      <ImportMembersForm />
    </section>
  );
}
