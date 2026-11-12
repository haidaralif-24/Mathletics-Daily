-- 01_questions.sql — checklist docs/SECURITY.md #1
--   "Anon cannot read an unreleased question, any key, any mark scheme, any solution before close"
-- plus checklist #16 (admin read surface) and two structural invariants the rest of the suite
-- relies on (RLS enabled everywhere, no client write policy anywhere, no client grant on the
-- sensitive tables).
--
-- Actors (fixed uuids, shared by every file in this suite):
--   admin     11111111-1111-1111-1111-111111111111
--   member A  22222222-2222-2222-2222-222222222222
--   member B  33333333-3333-3333-3333-333333333333
--   inactive  44444444-4444-4444-4444-444444444444
-- Questions (release_date derived from "now" in WIB so the suite passes at any hour):
--   q_open   a0000000-0000-0000-0000-000000000001  (today WIB, window open right now)
--   q_closed a0000000-0000-0000-0000-000000000002  (yesterday WIB, closed)
--   q_future a0000000-0000-0000-0000-000000000003  (tomorrow WIB, not released yet)
--
-- The runner connects as `postgres` (superuser, BYPASSRLS): every assertion below runs after an
-- explicit `set local role`, and fixtures are always created before the first role switch.

begin;
set search_path = extensions, public;
select plan(29);

-- =============================================================================================
-- Fixtures (superuser only: auth.users needs it, and the handle_new_user trigger makes profiles)
-- =============================================================================================
create temporary table fx on commit drop as
select d.open_date, d.open_date - 1 as closed_date, d.open_date + 1 as future_date
from (
  select case
           when (now() at time zone 'Asia/Jakarta')::time < time '04:00'
             then (now() at time zone 'Asia/Jakarta')::date - 1
           else (now() at time zone 'Asia/Jakarta')::date
         end as open_date
) d;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@mathletics.test', now(), '{"display_name":"Admin Klub"}'::jsonb, now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ani@mathletics.test', now(), '{"display_name":"Ani"}'::jsonb, now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'budi@mathletics.test', now(), '{"display_name":"Budi"}'::jsonb, now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'candra@mathletics.test', now(), '{"display_name":"Candra"}'::jsonb, now(), now());

update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set active = false, class_name = '9B' where id = '44444444-4444-4444-4444-444444444444';
update public.profiles set class_name = '9A' where id in ('22222222-2222-2222-2222-222222222222',
                                                          '33333333-3333-3333-3333-333333333333');

insert into public.questions (id, release_date, title, body_latex, image_path, topic, difficulty, created_by)
select 'a0000000-0000-0000-0000-000000000001', fx.open_date, 'Soal hari ini', '1+1=?', 'open/diagram.png',
       'aljabar', 2, '11111111-1111-1111-1111-111111111111' from fx;

insert into public.questions (id, release_date, title, body_latex, image_path, topic, difficulty, created_by)
select 'a0000000-0000-0000-0000-000000000002', fx.closed_date, 'Soal kemarin', '2+2=?', 'closed/diagram.png',
       'geometri', 3, '11111111-1111-1111-1111-111111111111' from fx;

insert into public.questions (id, release_date, title, body_latex, image_path, topic, difficulty, created_by)
select 'a0000000-0000-0000-0000-000000000003', fx.future_date, 'Soal besok', '3+3=?', 'future/diagram.png',
       'bilangan', 1, '11111111-1111-1111-1111-111111111111' from fx;

insert into public.question_keys (question_id, answer_type, accepted_answers, tolerance) values
  ('a0000000-0000-0000-0000-000000000001', 'integer', array['42'], null),
  ('a0000000-0000-0000-0000-000000000002', 'integer', array['7'], null),
  ('a0000000-0000-0000-0000-000000000003', 'integer', array['9'], null);

insert into public.question_markschemes (question_id, position, description_md, points) values
  ('a0000000-0000-0000-0000-000000000002', 1, 'Menuliskan rumus', 2),
  ('a0000000-0000-0000-0000-000000000002', 2, 'Hasil akhir', 4);

insert into public.question_solutions (question_id, solution_md, publish_markscheme) values
  ('a0000000-0000-0000-0000-000000000001', 'Solusi rahasia soal hari ini', true),
  ('a0000000-0000-0000-0000-000000000002', 'Solusi soal kemarin', true);

-- Self-check: the fixtures only prove things if q_open is genuinely open and q_future genuinely not.
select ok(
  (select release_at <= now() and now() < closes_at from public.questions
    where id = 'a0000000-0000-0000-0000-000000000001'),
  'prasyarat fixture: q_open sedang dalam jendela buka');
select ok(
  (select release_at > now() from public.questions where id = 'a0000000-0000-0000-0000-000000000003'),
  'prasyarat fixture: q_future belum rilis');
select ok(
  (select closes_at <= now() from public.questions where id = 'a0000000-0000-0000-0000-000000000002'),
  'prasyarat fixture: q_closed sudah ditutup');

-- =============================================================================================
-- Guest (anon)
-- =============================================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is_empty(
  $q$ select 1 from public.questions where id = 'a0000000-0000-0000-0000-000000000003' $q$,
  'anon tidak bisa membaca soal yang belum rilis');

select is((select count(*) from public.questions), 2::bigint,
          'anon hanya melihat 2 soal yang sudah rilis');

select ok(
  (select count(*) from public.questions where id = 'a0000000-0000-0000-0000-000000000001') = 1,
  'anon bisa membaca soal yang sudah dibuka');

select throws_ok('select * from public.question_keys', '42501',
                 'permission denied for table question_keys',
                 'anon: question_keys menolak dengan permission denied, bukan hasil kosong');

select throws_ok('select * from public.question_markschemes', '42501',
                 'permission denied for table question_markschemes',
                 'anon: question_markschemes menolak dengan permission denied');

select is_empty(
  $q$ select 1 from public.question_solutions where question_id = 'a0000000-0000-0000-0000-000000000001' $q$,
  'anon tidak bisa membaca solusi sebelum soal ditutup');

select ok(
  (select count(*) from public.question_solutions where question_id = 'a0000000-0000-0000-0000-000000000002') = 1,
  'anon bisa membaca solusi setelah soal ditutup');

-- =============================================================================================
-- Member A (authenticated, non-admin)
-- =============================================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select auth.uid()), '22222222-2222-2222-2222-222222222222'::uuid,
          'prasyarat: auth.uid() = member A (kalau NULL semua penolakan jadi palsu)');

select is_empty(
  $q$ select 1 from public.questions where id = 'a0000000-0000-0000-0000-000000000003' $q$,
  'member tidak bisa membaca soal yang belum rilis');

select is((select count(*) from public.questions), 2::bigint,
          'member hanya melihat soal yang sudah rilis');

select throws_ok('select * from public.question_keys', '42501',
                 'permission denied for table question_keys',
                 'member: question_keys tidak bisa dibaca langsung');

select throws_ok('select * from public.question_markschemes', '42501',
                 'permission denied for table question_markschemes',
                 'member: question_markschemes tidak bisa dibaca langsung');

select is_empty(
  $q$ select 1 from public.question_solutions where question_id = 'a0000000-0000-0000-0000-000000000001' $q$,
  'member tidak bisa membaca solusi sebelum soal ditutup');

select ok(
  (select count(*) from public.question_solutions where question_id = 'a0000000-0000-0000-0000-000000000002') = 1,
  'member bisa membaca solusi setelah soal ditutup');

-- =============================================================================================
-- Admin through the browser role (authenticated): sees everything, but still not the keys
-- =============================================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select count(*) from public.questions), 3::bigint,
          'admin melihat soal yang belum rilis');

select ok(
  (select count(*) from public.questions
    where id = 'a0000000-0000-0000-0000-000000000003' and release_at > now()) = 1,
  'kontrol: soal belum rilis memang ada di database');

select throws_ok('select * from public.question_keys', '42501',
                 'permission denied for table question_keys',
                 'admin pun tidak bisa membaca question_keys dari browser (service role saja)');

select ok(
  (select count(*) from public.question_solutions where question_id = 'a0000000-0000-0000-0000-000000000001') = 1,
  'admin bisa membaca solusi lewat policy admin');

-- =============================================================================================
-- Server path (service_role, used by server actions: loadGradingItem)
-- =============================================================================================
reset role;
set local role service_role;

select ok(
  (select count(*) from public.question_keys where question_id = 'a0000000-0000-0000-0000-000000000001') = 1,
  'service_role bisa membaca answer key (jalur server action)');

select ok(
  (select count(*) from public.question_markschemes where question_id = 'a0000000-0000-0000-0000-000000000002') = 2,
  'service_role bisa membaca mark scheme');

select is((select count(*) from public.questions), 3::bigint,
          'service_role melihat semua soal termasuk yang belum rilis');

-- =============================================================================================
-- Structural invariants for the whole schema
-- =============================================================================================
reset role;

select is_empty($q$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity
$q$, 'setiap tabel di schema public punya RLS aktif');

select is_empty($q$
  select p.polname
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and p.polcmd in ('a', 'w', 'd')
    and (p.polroles = '{0}'::oid[]
         or p.polroles && array['anon', 'authenticated']::regrole[]::oid[])
$q$, 'tidak ada policy INSERT/UPDATE/DELETE untuk anon/authenticated di schema public');

select is_empty($q$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and (has_table_privilege('anon', c.oid, 'INSERT,UPDATE,DELETE')
         or has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE'))
$q$, 'client roles tidak punya grant tulis di tabel public mana pun');

select ok(
  not has_table_privilege('anon', 'public.question_keys', 'SELECT')
    and not has_table_privilege('authenticated', 'public.question_keys', 'SELECT'),
  'question_keys tidak punya grant SELECT untuk anon/authenticated');

select ok(
  not has_table_privilege('anon', 'public.question_markschemes', 'SELECT')
    and not has_table_privilege('authenticated', 'public.question_markschemes', 'SELECT'),
  'question_markschemes tidak punya grant SELECT untuk anon/authenticated');

select * from finish();
rollback;
