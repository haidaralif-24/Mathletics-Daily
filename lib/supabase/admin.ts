import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from './env';

/**
 * Service-role client. SERVER ONLY (AGENTS.md hard rule 5).
 * Use it for what RLS must never expose: answer keys, auth user admin,
 * other members' data. Guard with requireAdmin()/requireUser() BEFORE using it.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(SUPABASE_URL(), SUPABASE_SERVICE_ROLE_KEY(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
