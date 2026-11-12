// Env access in one place. Values come from .env.local (git-ignored) or Vercel env vars.
// NEXT_PUBLIC_* is shipped to the browser; SUPABASE_SERVICE_ROLE_KEY must never be.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variabel lingkungan ${name} belum diisi. Salin .env.example ke .env.local dan lengkapi nilainya.`,
    );
  }
  return value;
}

export const SUPABASE_URL = () => required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);

export const SUPABASE_ANON_KEY = () =>
  required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Server-only. Throws if it ever ends up in a browser bundle. */
export const SUPABASE_SERVICE_ROLE_KEY = () => {
  if (typeof window !== 'undefined') {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY tidak boleh dipakai di sisi klien.');
  }
  return required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
};

/** True when the app is running against a local Supabase stack (supabase start). */
export const isLocalSupabase = () => /^https?:\/\/(127\.0\.0\.1|localhost)/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
