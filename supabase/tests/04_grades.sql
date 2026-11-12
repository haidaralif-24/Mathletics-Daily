-- 04_grades.sql — checklist docs/SECURITY.md #5 (grades), #3 (feedback), #13, #16
--   5  Member cannot insert/update/delete grades directly
--   3  Member A cannot read B's grade or feedback
--   13 A grade is invisible to the member until the question has closed (both directions: it appears
--      once closes_at passes, checked by moving the question's release_date back in this transaction)
--   16 Admin can read and grade everything (read: authenticated admin; write: service_role, the
--      server-action path)
--
-- Actors: admin 1111..., member A 2222..., member B 3333..., member C 5555...
-- Questions: q_open a0..01 (open now), q_closed a0..02 (closed), q_future a0..03 (unreleased)
-- Submissions: A/q_closed b0..01, B/q_closed b0..02, A/q_open b0..03, B/q_open b0..04, C/q_open b0..05

begin;
set search_path = extensions, public;
select plan(29);

-- =============================================================================================
-- Fixtures
-- =============================================================================================
create temporary table fx on commit drop as
select d.open_date, d.open_date - 1 as closed_date, d.open_date - 2 as free_past_date,
       d.open_date + 1 as future_date
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
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dewi@mathletics.test', now(), '{"display_name":"Dewi"}'::jsonb, now(), now());

update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set class_name = '9A'
  where id in ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333',
               '55555555-5555-5555-5555-555555555555');

insert into public.questions (id, release_date, title, body_latex, topic, difficulty, created_by)
select 'a0000000-0000-0000-0000-000000000001', fx.open_date, 'Soal hari ini', '1+1=?', 'aljabar', 2,
       '11111111-1111-1111-1111-111111111111' from fx;
insert into public.questions (id, release_date, title, body_latex, topic, difficulty, created_by)
select 'a0000000-0000-0000-0000-000000000002', fx.closed_date, 'Soal kemarin', '2+2=?', 'geometri', 3,
       '11111111-1111-1111-1111-111111111111' from fx;
insert into public.questions (id, release_date, title, body_latex, topic, difficulty, created_by)
select 'a0000000-0000-0000-0000-000000000003', fx.future_date, 'Soal besok', '3+3=?', 'bilangan', 1,
       '11111111-1111-1111-1111-111111111111' from fx;

update fx set open_date = (select release_date from public.questions
                           where id = 'a0000000-0000-0000-0000-000000000001');

insert into public.submissions (id, question_id, user_id, final_answer, steps_text, step_photo_paths,
                                auto_verdict, first_submitted_at)
values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222', '7', 'Langkah A kemarin', '{}', 'correct',
   (select release_at + interval '2 hours' from public.questions where id = 'a0000000-0000-0000-0000-000000000002')),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002',
   '33333333-3333-3333-3333-333333333333', '9', 'Langkah B kemarin', '{}', 'wrong',
   (select release_at + interval '3 hours' from public.questions where id = 'a0000000-0000-0000-0000-000000000002')),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', '42', 'Langkah A hari ini', '{}', 'needs_review',
   (select release_at + interval '1 hour' from public.questions where id = 'a0000000-0000-0000-0000-000000000001')),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   '33333333-3333-3333-3333-333333333333', '43', 'Langkah B hari ini', '{}', 'needs_review',
   (select release_at + interval '2 hours' from public.questions where id = 'a0000000-0000-0000-0000-000000000001')),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   '55555555-5555-5555-5555-555555555555', '44', 'Langkah C hari ini', '{}', 'needs_review',
   (select release_at + interval '3 hours' from public.questions where id = 'a0000000-0000-0000-0000-000000000001'));

insert into public.grades (submission_id, is_correct, base_points, speed_points, steps_points,
                           private_feedback, graded_by)
values
  ('b0000000-0000-0000-0000-000000000001', true, 6, 3, 2, 'Rapi sekali', '11111111-1111-1111-1111-111111111111'),
  ('b0000000-0000-0000-0000-000000000002', false, 0, 0, 2, 'Periksa lagi langkah B', '11111111-1111-1111-1111-111111111111'),
  ('b0000000-0000-0000-0000-000000000003', true, 6, 3, 2, 'Catatan untuk A (soal masih buka)', '11111111-1111-1111-1111-111111111111'),
  ('b0000000-0000-0000-0000-000000000004', true, 6, 3, 2, 'Catatan untuk B (soal masih buka)', '11111111-1111-1111-1111-111111111111');

select ok(
  (select release_at <= now() and now() < closes_at from public.questions
    where id = 'a0000000-0000-0000-0000-000000000001'),
  'prasyarat fixture: q_open sedang dalam jendela buka');
select ok(
  (select closes_at <= now() from public.questions where id = 'a0000000-0000-0000-0000-000000000002'),
  'prasyarat fixture: q_closed sudah ditutup');

-- =============================================================================================
-- Member A: only their own grade, and only once the question has closed (#13, #3)
-- =============================================================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select auth.uid()), '22222222-2222-2222-2222-222222222222'::uuid,
          'prasyarat: auth.uid() = member A');

select is((select count(*) from public.grades), 1::bigint,
          'A hanya melihat 1 nilai: miliknya di soal yang sudah ditutup');
select is((select total_points from public.grades), 11::numeric,
          'nilai yang terlihat adalah milik A sendiri (6+3+2)');
select ok((select is_correct from public.grades), 'nilai yang terlihat cocok dengan fixture A');

select is_empty($q$ select 1 from public.grades where submission_id = 'b0000000-0000-0000-0000-000000000002' $q$,
                'A tidak bisa membaca nilai B di soal yang sudah ditutup');
select is_empty($q$ select private_feedback from public.grades
                 where submission_id = 'b0000000-0000-0000-0000-000000000002' $q$,
                'A tidak bisa membaca feedback privat milik B');
select is_empty($q$ select 1 from public.grades where submission_id = 'b0000000-0000-0000-0000-000000000003' $q$,
                'A tidak bisa membaca nilainya sendiri selama soal masih terbuka');
select is_empty($q$ select private_feedback from public.grades
                 where submission_id = 'b0000000-0000-0000-0000-000000000003' $q$,
                'feedback untuk A belum terlihat selama soal masih terbuka');
select is_empty($q$ select 1 from public.grades where submission_id = 'b0000000-0000-0000-0000-000000000004' $q$,
                'A tidak bisa membaca nilai B di soal yang masih terbuka');

-- A cannot grade themselves, directly (#5)
select throws_ok($q$ insert into public.grades (submission_id, is_correct, base_points)
                    values ('b0000000-0000-0000-0000-000000000003', true, 20) $q$,
                 '42501', null, 'A tidak bisa INSERT ke grades (menilai dirinya sendiri)');
select throws_ok($q$ update public.grades set is_correct = true, base_points = 20 $q$,
                 '42501', null, 'A tidak bisa UPDATE grades');
select throws_ok($q$ delete from public.grades $q$,
                 '42501', null, 'A tidak bisa DELETE grades');

select is((select count(*) from public.grades)::int, 1,
          'kontrol: percobaan tulis di atas tidak menambah/menghapus apa pun');

-- =============================================================================================
-- Member B: same isolation, mirrored
-- =============================================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

select is((select count(*) from public.grades), 1::bigint,
          'B hanya melihat 1 nilai: miliknya di soal yang sudah ditutup');
select is_empty($q$ select private_feedback from public.grades
                 where submission_id = 'b0000000-0000-0000-0000-000000000001' $q$,
                'B tidak bisa membaca feedback milik A');

-- =============================================================================================
-- Admin (browser role): read everything, write nothing
-- =============================================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select count(*) from public.grades), 4::bigint,
          'admin melihat semua nilai, termasuk soal yang masih terbuka');
select ok(
  (select count(*) from public.grades where private_feedback like 'Catatan untuk A%') = 1,
  'admin bisa membaca feedback privat');
select throws_ok($q$ insert into public.grades (submission_id, is_correct)
                    values ('b0000000-0000-0000-0000-000000000005', true) $q$,
                 '42501', null, 'admin pun tidak menulis grades dari browser (memakai service role)');

-- =============================================================================================
-- The server-action path (service_role) grades and regrades (#16)
-- =============================================================================================
reset role;
set local role service_role;

select lives_ok($q$ insert into public.grades (submission_id, is_correct, base_points, speed_points,
                                               steps_points, criteria_ticks, private_feedback, graded_by)
                    values ('b0000000-0000-0000-0000-000000000005', true, 4, 2, 1,
                            '[{"position":1,"awarded":true}]'::jsonb, 'Bagus, Dewi',
                            '11111111-1111-1111-1111-111111111111') $q$,
                 'service_role bisa menyimpan nilai baru (saveGrade)');
select is((select total_points from public.grades where submission_id = 'b0000000-0000-0000-0000-000000000005'),
          7::numeric, 'total_points dihitung database (4+2+1)');
select lives_ok($q$ update public.grades set is_correct = true, base_points = 4
                    where submission_id = 'b0000000-0000-0000-0000-000000000002' $q$,
                 'service_role bisa memperbaiki nilai (regrade)');
reset role;
select is((select total_points from public.grades where submission_id = 'b0000000-0000-0000-0000-000000000002'),
          6::numeric, 'nilai B berubah menjadi 4+0+2 setelah regrade');
select is((select count(*) from public.grades), 5::bigint,
          'kontrol: sekarang ada 5 baris grades');

-- =============================================================================================
-- The other half of #13: once closes_at passes, the member's own grade appears
-- =============================================================================================
-- Move q_open into the past (a free date: mutation is rolled back at the end of this file).
update public.questions set release_date = (select free_past_date from fx)
  where id = 'a0000000-0000-0000-0000-000000000001';

select ok(
  (select closes_at <= now() from public.questions where id = 'a0000000-0000-0000-0000-000000000001'),
  'prasyarat: q_open sekarang sudah lewat closes_at');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*) from public.grades), 2::bigint,
          'setelah soal ditutup, A melihat nilai keduanya');
select ok(
  (select total_points from public.grades where submission_id = 'b0000000-0000-0000-0000-000000000003') = 11,
  'nilai A sendiri untuk soal itu sekarang terlihat');
select is_empty($q$ select 1 from public.grades
                 where submission_id in ('b0000000-0000-0000-0000-000000000002',
                                         'b0000000-0000-0000-0000-000000000004') $q$,
                'A tetap tidak bisa membaca nilai B, walau soal sudah ditutup');

select * from finish();
rollback;
