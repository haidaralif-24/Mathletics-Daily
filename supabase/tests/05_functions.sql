-- 05_functions.sql — checklist docs/SECURITY.md #6 (app_settings / get_osn_date) and #11 (leaderboard),
-- plus the "Function privileges" table at the bottom of docs/SECURITY.md.
--   6  Member cannot read app_settings directly; get_osn_date() works and returns only the date
--   11 leaderboard() returns no answers, photos or feedback; excludes admins and inactive members;
--      unknown period raises; total_points matches the saved grade; the tie-break ordering holds
--      (points desc, correct desc, avg submit seconds asc nulls last, display name); week works.
--
-- Actors: admin 1111..., member A 2222..., B 3333..., inactive 4444..., C 5555..., D 6666...,
--         E 7777... (no submissions), F 8888... (ungraded submission), G 9999... (last week only)
-- Questions: q_week a1..01 (Monday of the current WIB week), q_old a1..02 (the Sunday before it).
--   Every member keeps the same total_points where the tie-break matters, so the ordering is decided
--   by correct_count, then average submit seconds, then display_name — each of which is needed to
--   produce the expected order below, so a missing tie-break cannot pass silently.
--     Ani  total 11 correct 1 avg 3600    Budi total 11 correct 1 avg 10800
--     Cici total 11 correct 0 avg 1800    Dewi total 11 correct 1 avg 3600
--     Fani total  0 correct 0 avg 7200    Eka  total  0 correct 0 avg NULL
--     Gita total 20 correct 1 (last week only)  -> week view: total 0, attempted 0
--   overall: Gita, Ani, Dewi, Budi, Cici, Fani, Eka
--   week:    Ani, Dewi, Budi, Cici, Fani, Eka, Gita

begin;
set search_path = extensions, public;
select plan(44);

-- =============================================================================================
-- Fixtures
-- =============================================================================================
create temporary table fx on commit drop as
select date_trunc('week', (now() at time zone 'Asia/Jakarta')::date)::date as week_monday;
alter table fx add column prev_sunday date;
update fx set prev_sunday = week_monday - 1;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@mathletics.test', now(), '{"display_name":"Admin Klub"}'::jsonb, now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ani@mathletics.test', now(), '{"display_name":"Ani"}'::jsonb, now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'budi@mathletics.test', now(), '{"display_name":"Budi"}'::jsonb, now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'hana@mathletics.test', now(), '{"display_name":"Hana"}'::jsonb, now(), now()),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cici@mathletics.test', now(), '{"display_name":"Cici"}'::jsonb, now(), now()),
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dewi@mathletics.test', now(), '{"display_name":"Dewi"}'::jsonb, now(), now()),
  ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'eka@mathletics.test', now(), '{"display_name":"Eka"}'::jsonb, now(), now()),
  ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'fani@mathletics.test', now(), '{"display_name":"Fani"}'::jsonb, now(), now()),
  ('99999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gita@mathletics.test', now(), '{"display_name":"Gita"}'::jsonb, now(), now());

update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set active = false, class_name = '9B' where id = '44444444-4444-4444-4444-444444444444';
update public.profiles set class_name = '9A';

update public.app_settings set osn_date = date '2027-04-01';

insert into public.questions (id, release_date, title, body_latex, topic, difficulty, created_by)
select 'a1000000-0000-0000-0000-000000000001', fx.week_monday, 'Soal minggu ini', '1+1=?', 'aljabar', 2,
       '11111111-1111-1111-1111-111111111111' from fx;
insert into public.questions (id, release_date, title, body_latex, topic, difficulty, created_by)
select 'a1000000-0000-0000-0000-000000000002', fx.prev_sunday, 'Soal minggu lalu', '2+2=?', 'geometri', 3,
       '11111111-1111-1111-1111-111111111111' from fx;

insert into public.submissions (id, question_id, user_id, final_answer, steps_text, auto_verdict, first_submitted_at)
values
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', 'SENTINEL-ANW-A', 'Langkah Ani', 'needs_review',
   (select release_at + interval '1 hour' from public.questions where id = 'a1000000-0000-0000-0000-000000000001')),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
   '33333333-3333-3333-3333-333333333333', '121', 'Langkah Budi', 'needs_review',
   (select release_at + interval '3 hours' from public.questions where id = 'a1000000-0000-0000-0000-000000000001')),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001',
   '55555555-5555-5555-5555-555555555555', '144', 'Langkah Cici', 'needs_review',
   (select release_at + interval '30 minutes' from public.questions where id = 'a1000000-0000-0000-0000-000000000001')),
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001',
   '66666666-6666-6666-6666-666666666666', '169', 'Langkah Dewi', 'needs_review',
   (select release_at + interval '1 hour' from public.questions where id = 'a1000000-0000-0000-0000-000000000001')),
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001',
   '88888888-8888-8888-8888-888888888888', '196', 'Langkah Fani', 'needs_review',
   (select release_at + interval '2 hours' from public.questions where id = 'a1000000-0000-0000-0000-000000000001')),
  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002',
   '99999999-9999-9999-9999-999999999999', 'SENTINEL-ANW-G', 'Langkah Gita', 'needs_review',
   (select release_at + interval '1 hour' from public.questions where id = 'a1000000-0000-0000-0000-000000000002')),
  -- Rows that must never reach the leaderboard: the admin's and the deactivated member's.
  ('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', '225', 'Langkah Admin', 'needs_review',
   (select release_at + interval '10 minutes' from public.questions where id = 'a1000000-0000-0000-0000-000000000001')),
  ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000001',
   '44444444-4444-4444-4444-444444444444', '256', 'Langkah Hana', 'needs_review',
   (select release_at + interval '5 minutes' from public.questions where id = 'a1000000-0000-0000-0000-000000000001'));

insert into public.grades (submission_id, is_correct, base_points, speed_points, steps_points,
                           private_feedback, graded_by)
values
  ('b1000000-0000-0000-0000-000000000001', true, 6, 3, 2, 'SENTINEL-FEEDBACK-A', '11111111-1111-1111-1111-111111111111'),
  ('b1000000-0000-0000-0000-000000000002', true, 6, 3, 2, 'Bagus Budi', '11111111-1111-1111-1111-111111111111'),
  -- Cici: same 11 points but wrong, so correct_count has to break the tie.
  ('b1000000-0000-0000-0000-000000000003', false, 0, 6, 5, 'Periksa Cici', '11111111-1111-1111-1111-111111111111'),
  ('b1000000-0000-0000-0000-000000000004', true, 6, 3, 2, 'Bagus Dewi', '11111111-1111-1111-1111-111111111111'),
  ('b1000000-0000-0000-0000-000000000006', true, 8, 8, 4, 'SENTINEL-FEEDBACK-G', '11111111-1111-1111-1111-111111111111'),
  ('b1000000-0000-0000-0000-000000000007', true, 8, 8, 4, 'Nilai admin', '11111111-1111-1111-1111-111111111111'),
  ('b1000000-0000-0000-0000-000000000008', true, 8, 8, 4, 'Nilai Hana', '11111111-1111-1111-1111-111111111111');

select ok((select extract(isodow from week_monday) = 1 from fx),
          'prasyarat fixture: awal minggu WIB adalah hari Senin');
select ok((select extract(isodow from prev_sunday) = 7 from fx),
          'prasyarat fixture: q_old adalah hari Minggu sebelum minggu ini');

-- =============================================================================================
-- Function privileges (docs/SECURITY.md "Function privileges")
-- =============================================================================================
select ok(has_function_privilege('authenticated', 'public.leaderboard(text)', 'execute'),
          'leaderboard(text) bisa dieksekusi oleh authenticated');
select ok(not has_function_privilege('anon', 'public.leaderboard(text)', 'execute'),
          'leaderboard(text) tidak bisa dieksekusi oleh anon');
select ok(has_function_privilege('authenticated', 'public.get_osn_date()', 'execute'),
          'get_osn_date() bisa dieksekusi oleh authenticated');
select ok(not has_function_privilege('anon', 'public.get_osn_date()', 'execute'),
          'get_osn_date() tidak bisa dieksekusi oleh anon');
select ok(has_function_privilege('authenticated', 'public.is_admin()', 'execute')
          and has_function_privilege('authenticated', 'public.is_active_member()', 'execute'),
          'is_admin() dan is_active_member() bisa dieksekusi oleh authenticated');
select ok(not has_function_privilege('anon', 'public.is_admin()', 'execute')
          and not has_function_privilege('anon', 'public.is_active_member()', 'execute'),
          'is_admin() dan is_active_member() tidak bisa dieksekusi oleh anon');
select ok(not has_function_privilege('authenticated', 'public.flag_needs_regrade()', 'execute')
          and not has_function_privilege('authenticated', 'public.set_updated_at()', 'execute')
          and not has_function_privilege('anon', 'public.flag_needs_regrade()', 'execute')
          and not has_function_privilege('anon', 'public.set_updated_at()', 'execute'),
          'fungsi trigger bukan API surface untuk anon maupun authenticated');
select is(
  (select pg_get_function_result(p.oid) from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'leaderboard'),
  'TABLE(rank bigint, user_id uuid, display_name text, class_name text, total_points numeric, '
  'correct_count bigint, attempted bigint, avg_submit_seconds numeric)',
  'leaderboard() hanya mengembalikan kolom agregat (tanpa jawaban, foto, atau feedback)');

-- =============================================================================================
-- Guest (anon)
-- =============================================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok('select * from public.app_settings', '42501', 'permission denied for table app_settings',
                 'anon tidak punya grant SELECT pada app_settings');
select throws_ok('select public.get_osn_date()', '42501', 'permission denied for function get_osn_date',
                 'anon tidak bisa memanggil get_osn_date()');
select throws_ok('select * from public.leaderboard()', '42501', 'permission denied for function leaderboard',
                 'anon tidak bisa memanggil leaderboard()');
select throws_ok('select public.is_admin()', '42501', 'permission denied for function is_admin',
                 'anon tidak bisa memanggil helper policy is_admin()');

-- =============================================================================================
-- Member A: app_settings (#6) and leaderboard (#11)
-- =============================================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select auth.uid()), '22222222-2222-2222-2222-222222222222'::uuid,
          'prasyarat: auth.uid() = member A');

select is_empty($q$ select 1 from public.app_settings $q$,
                'member tidak bisa membaca app_settings langsung');
select is((select public.get_osn_date()), '2027-04-01'::date,
          'get_osn_date() mengembalikan tanggal OSN untuk member');
select is((select pg_get_function_result(p.oid) from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.proname = 'get_osn_date'),
          'date', 'get_osn_date() hanya mengembalikan satu nilai bertipe date');

select is((select count(*) from public.leaderboard('overall')), 7::bigint,
          'leaderboard overall memuat 7 anggota aktif (admin dan anggota nonaktif tidak ikut)');
select is_empty($q$ select 1 from public.leaderboard() where user_id = '11111111-1111-1111-1111-111111111111' $q$,
                'admin tidak muncul di leaderboard');
select is_empty($q$ select 1 from public.leaderboard() where user_id = '44444444-4444-4444-4444-444444444444' $q$,
                'anggota nonaktif tidak muncul di leaderboard');
select is_empty($q$ select 1 from public.leaderboard('overall') l
                 where l::text like '%SENTINEL%' $q$,
                'tidak ada jawaban atau feedback yang bocor lewat leaderboard()');

select results_eq(
  $q$ select l.user_id from public.leaderboard('overall') l order by l.rank $q$,
  $q$ select e.user_id from (values
        (1, '99999999-9999-9999-9999-999999999999'::uuid),
        (2, '22222222-2222-2222-2222-222222222222'::uuid),
        (3, '66666666-6666-6666-6666-666666666666'::uuid),
        (4, '33333333-3333-3333-3333-333333333333'::uuid),
        (5, '55555555-5555-5555-5555-555555555555'::uuid),
        (6, '88888888-8888-8888-8888-888888888888'::uuid),
        (7, '77777777-7777-7777-7777-777777777777'::uuid)
      ) as e(ord, user_id) order by e.ord $q$,
  'urutan overall: poin, lalu jumlah benar, lalu rata-rata waktu kirim, lalu nama');

select results_eq(
  $q$ select l.user_id from public.leaderboard('week') l order by l.rank $q$,
  $q$ select e.user_id from (values
        (1, '22222222-2222-2222-2222-222222222222'::uuid),
        (2, '66666666-6666-6666-6666-666666666666'::uuid),
        (3, '33333333-3333-3333-3333-333333333333'::uuid),
        (4, '55555555-5555-5555-5555-555555555555'::uuid),
        (5, '88888888-8888-8888-8888-888888888888'::uuid),
        (6, '77777777-7777-7777-7777-777777777777'::uuid),
        (7, '99999999-9999-9999-9999-999999999999'::uuid)
      ) as e(ord, user_id) order by e.ord $q$,
  'urutan mingguan sama, tanpa kiriman minggu lalu');

select is((select total_points from public.leaderboard('overall')
            where user_id = '22222222-2222-2222-2222-222222222222'), 11::numeric,
          'total_points leaderboard sama dengan nilai yang disimpan (6+3+2)');
select is((select correct_count from public.leaderboard('overall')
            where user_id = '22222222-2222-2222-2222-222222222222'), 1::bigint,
          'correct_count menghitung kiriman yang dinilai benar');
select is((select attempted from public.leaderboard('overall')
            where user_id = '22222222-2222-2222-2222-222222222222'), 1::bigint,
          'attempted menghitung kiriman A');
select is((select class_name from public.leaderboard('overall')
            where user_id = '22222222-2222-2222-2222-222222222222'), '9A',
          'class_name ikut dikembalikan untuk papan peringkat per kelas');
select ok(
  (select abs(avg_submit_seconds - 3600) < 0.001 from public.leaderboard('overall')
    where user_id = '22222222-2222-2222-2222-222222222222'),
  'avg_submit_seconds dihitung dari first_submitted_at - release_at (1 jam)');
select ok(
  (select abs(avg_submit_seconds - 10800) < 0.001 from public.leaderboard('overall')
    where user_id = '33333333-3333-3333-3333-333333333333'),
  'Budi 3 jam: rata-rata kirim menentukan urutan saat poin dan jumlah benar sama');

select is((select total_points from public.leaderboard('overall')
            where user_id = '99999999-9999-9999-9999-999999999999'), 20::numeric,
          'Gita memimpin overall dengan 20 poin');
select is((select total_points from public.leaderboard('week')
            where user_id = '99999999-9999-9999-9999-999999999999'), 0::numeric,
          'p_period = week mengabaikan kiriman minggu lalu (hari Minggu sebelum Senin)');
select is((select attempted from public.leaderboard('week')
            where user_id = '99999999-9999-9999-9999-999999999999'), 0::bigint,
          'p_period = week tidak menghitung attempt di luar minggu ini');
select ok((select avg_submit_seconds is null from public.leaderboard('week')
            where user_id = '77777777-7777-7777-7777-777777777777'),
          'anggota tanpa kiriman punya avg_submit_seconds NULL');
select is((select total_points from public.leaderboard('week')
            where user_id = '77777777-7777-7777-7777-777777777777'), 0::numeric,
          'anggota tanpa kiriman tetap muncul dengan 0 poin');

select throws_ok($q$ select * from public.leaderboard('monthly') $q$,
                 'P0001', 'Periode tidak dikenal: gunakan overall atau week',
                 'periode yang tidak dikenal ditolak');
select throws_ok($q$ select * from public.leaderboard(null) $q$,
                 'P0001', 'Periode tidak dikenal: gunakan overall atau week',
                 'periode NULL ditolak');

-- =============================================================================================
-- Admin: app_settings direct read is allowed (admin action path)
-- =============================================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select count(*) from public.app_settings), 1::bigint,
          'admin bisa membaca app_settings langsung');
select is((select osn_date from public.app_settings), '2027-04-01'::date,
          'admin melihat tanggal OSN');
select is((select public.get_osn_date()), '2027-04-01'::date,
          'get_osn_date() juga bekerja untuk admin');

-- =============================================================================================
-- submit_answer rejects admins (SPEC.md section 3: "Submit steps and photos" is No for admins)
-- =============================================================================================
reset role;

-- An open question: today in WIB once 04:00 has passed, otherwise yesterday (so the window
-- [release_at, closes_at) always contains now()).
create temporary table fx_open on commit drop as
select case
         when (now() at time zone 'Asia/Jakarta')::time >= time '04:00'
           then (now() at time zone 'Asia/Jakarta')::date
         else (now() at time zone 'Asia/Jakarta')::date - 1
       end as open_date;

insert into public.questions (id, release_date, title, body_latex, created_by)
select 'a1000000-0000-0000-0000-000000000003', fx.open_date, 'Soal terbuka', '3+3=?',
       '11111111-1111-1111-1111-111111111111'
from fx_open fx;

select is((select count(*) from public.questions
            where id = 'a1000000-0000-0000-0000-000000000003'
              and release_at <= now() and now() < closes_at), 1::bigint,
          'prasyarat fixture: soal uji sedang terbuka');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select throws_ok(
  $q$ select public.submit_answer('a1000000-0000-0000-0000-000000000003', '6', 'langkah admin', null, null) $q$,
  'P0001', 'Admin tidak mengirim jawaban',
  'admin tidak bisa memakai submit_answer, walaupun soalnya sedang terbuka');

select is_empty(
  $q$ select 1 from public.submissions
       where question_id = 'a1000000-0000-0000-0000-000000000003'
         and user_id = '11111111-1111-1111-1111-111111111111' $q$,
  'penolakan admin tidak menyisakan baris submission');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select ok(
  (select public.submit_answer('a1000000-0000-0000-0000-000000000003', '6', 'langkah saya', null, null)) is not null,
  'anggota tetap bisa mengirim jawaban pada soal yang sama');

select * from finish();
rollback;
