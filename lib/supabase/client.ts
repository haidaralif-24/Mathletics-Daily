'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

/**
 * Browser client for RLS-guarded reads (released questions, own submissions,
 * leaderboard). It never sees the service role key.
 */
export function createSupabaseBrowserClient() {
  browserClient ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return browserClient;
}
