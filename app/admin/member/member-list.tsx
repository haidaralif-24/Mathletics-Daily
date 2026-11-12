import Link from 'next/link';
import { MemberRowActions } from '@/components/members/member-row-actions';
import type { MemberRow } from '@/components/members/types';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatWib } from '@/lib/time';
import { cn } from '@/lib/utils';

const SEARCH_MAX = 120;
const MEMBER_LIMIT = 300;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function MemberListSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Memuat daftar anggota">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-11 w-full" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-16 w-full rounded-lg" />
        ))}
      </CardContent>
    </Card>
  );
}

/** `q` may arrive as an array (`?q=a&q=b`); take the first value and clamp it. */
function readQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return '';
  return raw.trim().slice(0, SEARCH_MAX);
}

/**
 * Only `%` and `_` are wildcards for `ilike`; commas, parentheses and asterisks
 * would break the PostgREST `or` filter, so they are dropped instead.
 */
function sanitizeForFilter(query: string): string {
  return query.replace(/[%_,()*\\]/g, ' ').trim();
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tidak diketahui';
  // Always WIB, whatever the server or device timezone is (S-2).
  return formatWib(date);
}

async function loadMembers(query: string): Promise<{ members: MemberRow[]; failed: boolean }> {
  const admin = createSupabaseAdminClient();

  let request = admin
    .from('profiles')
    .select('id, email, display_name, class_name, role, active, must_change_password, created_at')
    .order('display_name', { ascending: true })
    .limit(MEMBER_LIMIT);

  const needle = sanitizeForFilter(query);
  if (needle.length > 0) {
    const pattern = `%${needle}%`;
    request = request.or(`email.ilike.${pattern},display_name.ilike.${pattern}`);
  }

  const { data, error } = await request;
  if (error) return { members: [], failed: true };

  const members: MemberRow[] = (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    className: row.class_name,
    role: row.role === 'admin' ? 'admin' : 'member',
    active: Boolean(row.active),
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: row.created_at,
  }));

  return { members, failed: false };
}

function StatusBadges({ member }: { member: MemberRow }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge variant={member.role === 'admin' ? 'secondary' : 'outline'}>
        {member.role === 'admin' ? 'Admin' : 'Anggota'}
      </Badge>
      <Badge variant={member.active ? 'outline' : 'destructive'}>
        {member.active ? 'Aktif' : 'Nonaktif'}
      </Badge>
      {member.mustChangePassword ? <Badge variant="outline">Belum ganti sandi</Badge> : null}
    </span>
  );
}

/** U-2: the member list with a search box, on top of data read with the service role. */
export async function MemberList({ searchParams }: { searchParams: SearchParams }) {
  const [caller, params] = await Promise.all([requireAdmin(), searchParams]);
  const query = readQuery(params.q);
  const { members, failed } = await loadMembers(query);

  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle>Daftar anggota</CardTitle>
        <form action="/admin/member" method="get" role="search" className="flex flex-wrap gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Label htmlFor="q" className="sr-only">
              Cari anggota
            </Label>
            <Input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Cari email atau nama"
              autoComplete="off"
              className="h-11"
            />
          </div>
          <button type="submit" className={cn(buttonVariants({ variant: 'secondary' }), 'h-11 px-4')}>
            Cari
          </button>
          {query.length > 0 ? (
            <Link
              href="/admin/member"
              className={cn(buttonVariants({ variant: 'ghost' }), 'h-11 px-4')}
            >
              Bersihkan
            </Link>
          ) : null}
        </form>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {failed ? (
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            Daftar anggota gagal dimuat. Muat ulang halaman; kalau masih gagal, periksa koneksi ke
            Supabase.
          </p>
        ) : null}

        {!failed && members.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-sm font-medium text-foreground">
              {query.length > 0 ? 'Tidak ada anggota yang cocok' : 'Belum ada anggota'}
            </p>
            <p className="text-sm text-muted-foreground">
              {query.length > 0
                ? 'Coba kata kunci lain, atau bersihkan pencarian untuk melihat semua anggota.'
                : 'Impor daftar siswa dari CSV di bawah untuk membuat akun anggota pertama.'}
            </p>
            {query.length > 0 ? (
              <Link
                href="/admin/member"
                className={cn(buttonVariants({ variant: 'outline' }), 'h-11 px-4')}
              >
                Bersihkan pencarian
              </Link>
            ) : null}
          </div>
        ) : null}

        {members.length > 0 ? (
          <>
            {/* Mobile: satu kartu per anggota (360 px). */}
            <ul className="flex flex-col gap-3 md:hidden">
              {members.map((member) => (
                <li key={member.id} className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">{member.displayName}</span>
                    <span className="text-xs break-all text-muted-foreground">{member.email}</span>
                    <span className="text-xs text-muted-foreground">
                      Kelas {member.className ?? '—'} · Terdaftar {formatDate(member.createdAt)}
                    </span>
                  </div>
                  <StatusBadges member={member} />
                  <MemberRowActions member={member} isSelf={member.id === caller.id} />
                </li>
              ))}
            </ul>

            {/* Desktop: tabel penuh. */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Terdaftar</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="whitespace-normal">
                        <span className="block font-medium text-foreground">{member.displayName}</span>
                        <span className="block text-xs break-all text-muted-foreground">{member.email}</span>
                      </TableCell>
                      <TableCell>{member.className ?? '—'}</TableCell>
                      <TableCell>
                        <StatusBadges member={member} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(member.createdAt)}</TableCell>
                      <TableCell>
                        <MemberRowActions member={member} isSelf={member.id === caller.id} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
