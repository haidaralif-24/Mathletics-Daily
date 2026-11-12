import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js 16 calls this "Proxy" (it was Middleware before). See
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
 *
 * Scope (docs/ARCHITECTURE.md): an optimistic gate only.
 *  - guests may reach `/` and `/login`; everything else goes to `/login`
 *  - a member with `must_change_password` is sent to `/ganti-sandi` first (A-3),
 *    read from `app_metadata` in the JWT so no database query is needed
 *  - the real authorisation check lives in `lib/auth.ts` (`requireUser`/`requireAdmin`),
 *    which reads the profile row through RLS. Proxy is never the only guard.
 */
const PUBLIC_PATHS = ['/', '/login', '/arsip'];

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/auth/');

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Auth cookies must never be cached by a CDN or reverse proxy.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Must run before the response is committed: a token refresh after that
  // point cannot write the new session cookie back.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const { pathname } = request.nextUrl;

  if (!claims?.sub) {
    if (isPublicPath(pathname)) return response;
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // A-3: forced password change blocks everything else.
  const mustChangePassword = claims.app_metadata?.must_change_password === true;
  if (mustChangePassword && pathname !== '/ganti-sandi' && pathname !== '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/ganti-sandi';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
