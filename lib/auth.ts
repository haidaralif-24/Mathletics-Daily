import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from './supabase/server';

export type Role = 'member' | 'admin';

/** What the app shell and every screen needs to know about the caller. Never includes secrets. */
export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  displayName: string;
  className: string | null;
  active: boolean;
  mustChangePassword: boolean;
}

export const isAdmin = (user: SessionUser | null): boolean => user?.role === 'admin';

/**
 * Returns the signed-in user, or null for guests. Verifies the JWT with
 * `getClaims()` (Supabase Auth), then reads the profile row through RLS
 * (members may read their own row; docs/DATA_MODEL.md).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabaseClient();

  const { data: claimsData, error } = await supabase.auth.getClaims();
  if (error || !claimsData?.claims?.sub) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, display_name, class_name, role, active, must_change_password')
    .eq('id', claimsData.claims.sub)
    .maybeSingle();

  if (!profile) return null;

  return {
    id: profile.id as string,
    email: profile.email as string,
    role: (profile.role as Role) ?? 'member',
    displayName: profile.display_name as string,
    className: (profile.class_name as string | null) ?? null,
    active: Boolean(profile.active),
    mustChangePassword: Boolean(profile.must_change_password),
  };
}

/** For member screens. Sends guests to /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!user.active) redirect('/login?nonaktif=1');
  if (user.mustChangePassword) redirect('/ganti-sandi');
  return user;
}

/** For /admin/*. Guests to /login, members back to Today. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/');
  return user;
}
