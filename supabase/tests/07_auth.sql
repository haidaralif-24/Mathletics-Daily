-- 07_auth.sql — checklist docs/SECURITY.md #18 and the DB side of #19
--   18 auth.signUp with the anon key is rejected (public signups disabled)
--   19 A newly created auth user gets a profiles row with role = member, active = true, never admin
--
-- NOT COVERED HERE: `auth.signUp` is a GoTrue HTTP call, not a SQL call, so pgTAP cannot exercise
-- it (see the note at the bottom of this file). Everything that CAN be checked in the database is
-- checked here: the auth schema is closed to client roles, no client can create an account or edit
-- app_metadata, and a hostile `raw_app_meta_data` / `raw_user_meta_data` cannot produce an admin.
--
-- Actors: admin 1111..., member A 2222..., new user 9999... (created with hostile metadata)
--
-- The runner connects as `postgres` (superuser, BYPASSRLS): fixtures first, then `set local role`.

begin;
set search_path = extensions, public;
select plan(20);

-- =============================================================================================
-- Fixtures
-- =============================================================================================
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@mathletics.test', now(), '{"display_name":"Admin Klub"}'::jsonb, now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ani@mathletics.test', now(), '{"display_name":"Ani"}'::jsonb, now(), now()),
  -- The account an attacker would try to create: an admin in both metadata blocks.
  ('99999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'penyusup@mathletics.test', now(),
   '{"display_name":"Penyusup","role":"admin","active":true,"must_change_password":false}'::jsonb,
   now(), now());

update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';
update auth.users
  set raw_app_meta_data = '{"provider":"email","role":"admin","must_change_password":false}'::jsonb
  where id = '99999999-9999-9999-9999-999999999999';

-- =============================================================================================
-- The auth schema is not client-readable (it holds emails, tokens and app_metadata)
-- =============================================================================================
select is_empty($q$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth'
    and c.relkind = 'r'
    and (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
         or has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE'))
$q$, 'client roles tidak punya grant apa pun di schema auth');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok('select * from auth.users', '42501', 'permission denied for table users',
                 'anon tidak bisa membaca auth.users');
select throws_ok($q$ insert into auth.users (id, email) values (gen_random_uuid(), 'x@mathletics.test') $q$,
                 '42501', 'permission denied for table users',
                 'anon tidak bisa membuat akun auth');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select auth.uid()), '22222222-2222-2222-2222-222222222222'::uuid,
          'prasyarat: auth.uid() = member A');

select throws_ok('select * from auth.users', '42501', 'permission denied for table users',
                 'member tidak bisa membaca auth.users');
select throws_ok($q$ insert into auth.users (id, email) values (gen_random_uuid(), 'baru@mathletics.test') $q$,
                 '42501', 'permission denied for table users',
                 'member tidak bisa mendaftarkan akun baru (tidak ada jalur signup di client)');
select throws_ok($q$ update auth.users
                    set raw_app_meta_data = '{"must_change_password":false}'::jsonb
                    where id = '22222222-2222-2222-2222-222222222222' $q$,
                 '42501', 'permission denied for table users',
                 'member tidak bisa mengubah app_metadata (mis. menghapus must_change_password)');
select throws_ok($q$ update auth.users
                    set banned_until = null where id = '22222222-2222-2222-2222-222222222222' $q$,
                 '42501', 'permission denied for table users',
                 'member tidak bisa mencabut ban dirinya sendiri');
select throws_ok($q$ delete from auth.users where id = '22222222-2222-2222-2222-222222222222' $q$,
                 '42501', 'permission denied for table users',
                 'member tidak bisa menghapus akun auth');

-- =============================================================================================
-- Hostile metadata cannot produce an admin profile (#19)
-- =============================================================================================
reset role;
select is((select role from public.profiles where id = '99999999-9999-9999-9999-999999999999'), 'member',
          'raw_user_meta_data + raw_app_meta_data yang mengaku admin tetap menghasilkan role member');
select is((select active from public.profiles where id = '99999999-9999-9999-9999-999999999999'), true,
          'profile pengguna baru active = true');
select is((select must_change_password from public.profiles where id = '99999999-9999-9999-9999-999999999999'), true,
          'must_change_password tidak bisa dimatikan dari app_metadata (proxy penyusup)');
select is((select display_name from public.profiles where id = '99999999-9999-9999-9999-999999999999'), 'Penyusup',
          'display_name boleh diisi dari metadata, itu bukan data sensitif');
select is((select count(*) from public.profiles where role = 'admin'), 1::bigint,
          'satu-satunya admin adalah yang dipromosikan eksplisit di database');
select is((select email from public.profiles where id = '99999999-9999-9999-9999-999999999999'),
          'penyusup@mathletics.test', 'email pengguna baru ikut tersalin ke profiles');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}', true);

select ok(not public.is_admin(), 'pengguna baru dengan metadata admin bukan admin');
select ok(public.is_active_member(), 'pengguna baru tetap anggota aktif');
select is((select count(*) from public.profiles), 1::bigint,
          'pengguna baru hanya melihat profilnya sendiri');
select throws_ok('select * from public.question_keys', '42501', 'permission denied for table question_keys',
                 'pengguna baru tidak bisa membaca kunci jawaban');

-- =============================================================================================
-- Fail-closed observation: an auth user without an email cannot be created
-- =============================================================================================
reset role;
select throws_ok($q$ insert into auth.users (id, instance_id) values (gen_random_uuid(),
                                                                      '00000000-0000-0000-0000-000000000000') $q$,
                 '23502', null,
                 'membuat auth user tanpa email gagal (NOT NULL pada profiles.display_name), bukan '
                 'membuat profil tanpa nama — akun selalu punya email lewat admin API');

select * from finish();
rollback;

-- ---------------------------------------------------------------------------------------------
-- Checklist #18 (`auth.signUp` dengan anon key ditolak) TIDAK diuji di sini.
-- `auth.signUp` adalah panggilan HTTP ke GoTrue (POST {url}/auth/v1/signup dengan header apikey),
-- bukan fungsi SQL, jadi pgTAP tidak bisa menjangkaunya. yang mengatur adalah
-- `enable_signup = false` di supabase/config.toml. Uji manual (atau di layer e2e/Vitest):
--
--   code=$(curl -s -o /tmp/signup.json -w '%{http_code}' \
--     -X POST "http://127.0.0.1:54321/auth/v1/signup" \
--     -H "apikey: $SUPABASE_ANON_KEY" -H 'Content-Type: application/json' \
--     -d '{"email":"signup-test@mathletics.test","password":"rahasia12345"}')
--   cat /tmp/signup.json   # harapan: 422 signup_disabled, bukan 200
--
-- Diverifikasi 2026-11-12: 422 {"code":422,"error_code":"signup_disabled",
-- "msg":"Signups not allowed for this instance"} dan tidak ada baris auth.users baru.
-- PENTING: GoTrue menerima konfigurasi ini lewat environment container, jadi container yang
-- dibuat sebelum `enable_signup = false` diubah MASIH membuka signup (terbukti: stack lama
-- menjawab 200 dan membuat akun). Setelah `supabase stop && supabase start`, signup ditolak.
-- Jalankan ulang probe curl ini setiap kali config.toml auth berubah, dan di CI/staging.
-- ---------------------------------------------------------------------------------------------
