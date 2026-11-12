'use client';

import { createBrowserClient } from '@supabase/ssr';

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

/**
 * Browser client for RLS-guarded reads (released questions, own submissions,
 * leaderboard). It never sees the service role key.
 */
export function createSupabaseBrowserClient() {
  browserClient ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return browserClient;
}
