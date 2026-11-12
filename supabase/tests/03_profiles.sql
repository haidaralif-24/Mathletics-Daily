-- 03_profiles.sql — checklist docs/SECURITY.md #2, #4, #19
--   2  Anon cannot read profiles, submissions, grades
--   4  A member cannot update ANY profiles column (role, active, display_name, class_name) and
--      cannot clear must_change_password
--   19 A newly created auth user gets a profiles row with role = member, active = true, never admin
--      (including the hostile case where the signup metadata claims role = admin)
--
-- Actors: admin 1111..., member A 2222..., member B 3333..., inactive 4444...,
--         new users 6666... (meta display_name), 7777... (meta claims admin), 8888... (no meta)
--
-- The runner connects as `postgres` (superuser, BYPASSRLS): fixtures first, then `set local role`.

begin;
set search_path = extensions, public;
select plan(34);

-- =============================================================================================
-- Fixtures
-- =============================================================================================
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@mathletics.test', now(), '{"display_name":"Admin Klub"}'::jsonb, now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ani@mathletics.test', now(), '{"display_name":"Ani"}'::jsonb, now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'budi@mathletics.test', now(), '{"display_name":"Budi"}'::jsonb, now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'candra@mathletics.test', now(), '{"display_name":"Candra"}'::jsonb, now(), now()),
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'eka@mathletics.test', now(), '{"display_name":"Eka"}'::jsonb, now(), now()),
  -- Hostile metadata: the account somehow asks for admin rights at creation time.
  ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'penipu@mathletics.test', now(), '{"display_name":"Penipu","role":"admin","active":true}'::jsonb, now(), now()),
  -- No metadata at all: display_name must fall back to the email local part.
  ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'eko@mathletics.test', now(), null, now(), now());

update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set active = false, class_name = '9B' where id = '44444444-4444-4444-4444-444444444444';
update public.profiles set class_name = '9A'
  where id in ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');

select is((select count(*) from public.profiles), 7::bigint,
          'prasyarat: trigger handle_new_user membuat 7 baris profiles');

-- =============================================================================================
-- Guest (#2)
-- =============================================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok('select * from public.profiles', '42501', 'permission denied for table profiles',
                 'anon tidak bisa membaca profiles');
select throws_ok('select * from public.submissions', '42501', 'permission denied for table submissions',
                 'anon tidak bisa membaca submissions');
select throws_ok('select * from public.grades', '42501', 'permission denied for table grades',
                 'anon tidak bisa membaca grades');

-- =============================================================================================
-- Member A: row isolation
-- =============================================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select auth.uid()), '22222222-2222-2222-2222-222222222222'::uuid,
          'prasyarat: auth.uid() = member A');

select is((select count(*) from public.profiles), 1::bigint,
          'A hanya melihat 1 baris profiles (miliknya sendiri)');
select is_empty($q$ select 1 from public.profiles where id = '33333333-3333-3333-3333-333333333333' $q$,
                'A tidak bisa membaca profil B');
select is_empty($q$ select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111' $q$,
                'A tidak bisa membaca profil admin');
select is_empty($q$ select 1 from public.profiles where id = '44444444-4444-4444-4444-444444444444' $q$,
                'A tidak bisa membaca profil anggota nonaktif');
select ok((select display_name from public.profiles) = 'Ani',
          'A bisa membaca data dirinya sendiri (nama)');

-- =============================================================================================
-- Member A: no client write path on profiles (#4) — one attempt per column
-- =============================================================================================
select throws_ok($q$ update public.profiles set role = 'admin'
                    where id = '22222222-2222-2222-2222-222222222222' $q$,
                 '42501', 'permission denied for table profiles',
                 'A tidak bisa mengubah kolom role (escalation ke admin)');
select throws_ok($q$ update public.profiles set active = false
                    where id = '22222222-2222-2222-2222-222222222222' $q$,
                 '42501', 'permission denied for table profiles',
                 'A tidak bisa mengubah kolom active');
select throws_ok($q$ update public.profiles set display_name = 'Ani Palsu'
                    where id = '22222222-2222-2222-2222-222222222222' $q$,
                 '42501', 'permission denied for table profiles',
                 'A tidak bisa mengubah kolom display_name');
select throws_ok($q$ update public.profiles set class_name = '9Z'
                    where id = '22222222-2222-2222-2222-222222222222' $q$,
                 '42501', 'permission denied for table profiles',
                 'A tidak bisa mengubah kolom class_name');
select throws_ok($q$ update public.profiles set must_change_password = false
                    where id = '22222222-2222-2222-2222-222222222222' $q$,
                 '42501', 'permission denied for table profiles',
                 'A tidak bisa menghapus must_change_password');
select throws_ok($q$ update public.profiles set role = 'admin'
                    where id = '33333333-3333-3333-3333-333333333333' $q$,
                 '42501', 'permission denied for table profiles',
                 'A tidak bisa mengubah baris profil orang lain');
select throws_ok($q$ insert into public.profiles (id, email, display_name)
                    values ('99999999-9999-9999-9999-999999999999', 'x@mathletics.test', 'X') $q$,
                 '42501', 'permission denied for table profiles',
                 'A tidak bisa membuat baris profil');
select throws_ok($q$ delete from public.profiles
                    where id = '22222222-2222-2222-2222-222222222222' $q$,
                 '42501', 'permission denied for table profiles',
                 'A tidak bisa menghapus profilnya sendiri');

-- =============================================================================================
-- Admin through the browser role: read-all, but writes still need the service role
-- =============================================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select count(*) from public.profiles), 7::bigint,
          'admin melihat seluruh baris profiles');
select ok((select count(*) from public.profiles
            where email = 'budi@mathletics.test') = 1,
          'admin bisa membaca email anggota');
select throws_ok($q$ update public.profiles set active = false
                    where id = '33333333-3333-3333-3333-333333333333' $q$,
                 '42501', 'permission denied for table profiles',
                 'admin pun tidak bisa menulis profiles dari browser (harus service role)');

-- =============================================================================================
-- Nothing changed on disk after all those rejected writes
-- =============================================================================================
reset role;
select is((select role from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 'member',
          'role member A tetap member setelah semua percobaan escalation');
select is((select must_change_password from public.profiles where id = '22222222-2222-2222-2222-222222222222'), true,
          'must_change_password member A tidak berubah');
select is((select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 'Ani',
          'display_name member A tidak berubah');
select is((select active from public.profiles where id = '33333333-3333-3333-3333-333333333333'), true,
          'active member B tidak berubah');

-- An inactive member must still be able to read their own profile (the app shows "akun nonaktif").
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select is((select count(*) from public.profiles), 1::bigint,
          'anggota nonaktif tetap bisa membaca profilnya sendiri');

-- =============================================================================================
-- New auth users (#19)
-- =============================================================================================
reset role;
select is((select role from public.profiles where id = '66666666-6666-6666-6666-666666666666'), 'member',
          'pengguna baru dibuat sebagai member');
select is((select active from public.profiles where id = '66666666-6666-6666-6666-666666666666'), true,
          'pengguna baru dibuat active = true');
select is((select must_change_password from public.profiles where id = '66666666-6666-6666-6666-666666666666'), true,
          'pengguna baru wajib mengganti kata sandi');
select is((select display_name from public.profiles where id = '66666666-6666-6666-6666-666666666666'), 'Eka',
          'display_name diambil dari raw_user_meta_data');
select is((select display_name from public.profiles where id = '88888888-8888-8888-8888-888888888888'), 'eko',
          'tanpa metadata, display_name memakai bagian lokal email');
select is((select role from public.profiles where id = '77777777-7777-7777-7777-777777777777'), 'member',
          'metadata yang mengaku admin tetap dibuat sebagai member');
select is((select count(*) from public.profiles where role = 'admin'), 1::bigint,
          'hanya admin yang dipromosikan eksplisit yang punya role admin');
select ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
          'handle_new_user() bukan API surface untuk authenticated');

select * from finish();
rollback;
