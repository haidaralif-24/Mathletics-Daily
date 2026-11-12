// Seeds a Supabase project via the ADMIN API (SQL cannot create auth users cleanly).
// Run against STAGING first:  pnpm seed
//
// TODO:
//  - create the 2 admins (SEED_ADMIN_EMAILS, comma-separated, with SEED_ADMIN_PASSWORD), must_change_password = true
//    (the auth.users insert trigger creates each profiles row; then set role = admin and display_name)
//  - create ~5 dummy members with temporary passwords and must_change_password = true
//  - insert 3 sample questions with answer keys and mark schemes
//  - insert a few submissions and grades
// Never run this against production with dummy data.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

export const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

console.log('seed.ts is a stub. Implement it from docs/DATA_MODEL.md and docs/TASKS.md.');
