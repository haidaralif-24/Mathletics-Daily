-- 02_submissions.sql — checklist docs/SECURITY.md #3, #5, #7, #8, #9, #10, #11, #12, #14
--   3  Member A cannot read B's submission or photos
--   5  Member cannot insert/update/delete submissions directly (submit_answer is the only path)
--   7  The final answer cannot change after the first submit; first_submitted_at cannot change
--   8  Submit after closes_at ("Soal ini sudah ditutup") / before release_at ("Soal ini belum dibuka")
--   9  A deactivated member cannot submit; an unauthenticated call is rejected
--   10 Blank answer, blank steps, >5 photos, answer over 500 characters are rejected
--   11 A photo path containing another user's id is rejected
--   12 auto_verdict outside the allowed values becomes needs_review and never changes points
--   14 Editing steps after grading sets grades.needs_regrade; the final answer still cannot change
--   M-7 the verdict stays out of the member's reach: the column grant on `submissions` omits
--       `auto_verdict`, so selecting it (or selecting `*`) fails with 42501 while the service role
--       can still read it for the grading screen
-- plus: submit_answer is executable by `service_role` only (never by `authenticated` or `anon`),
-- takes an explicit `p_user_id` from the server action, and a member cannot call it directly — so a
-- member can neither submit as somebody else nor forge `p_auto_verdict` (DECISIONS 23, 30).
--
-- Actors: admin 1111..., member A 2222..., member B 3333..., inactive 4444..., member C 5555...
-- Questions: q_open a0..01 (open now), q_closed a0..02, q_future a0..03.
-- Submissions: A/q_open b0..03 (pre-graded), A/q_closed b0..01 (graded), B/q_closed b0..02 (graded).
--
-- The runner connects as `postgres` (superuser, BYPASSRLS), so every assertion runs after an
-- explicit `set local role`.

begin;
set search_path = extensions, public;
select plan(64);

-- =============================================================================================
-- Fixtures
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
alter table fx add column a_open_first timestamptz;

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
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dewi@mathletics.test', now(), '{"display_name":"Dewi"}'::jsonb, now(), now());

update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set active = false, class_name = '9B' where id = '44444444-4444-4444-4444-444444444444';
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

update fx set a_open_first = (select release_at from public.questions
                              where id = 'a0000000-0000-0000-0000-000000000001');

-- A already submitted on both questions; the open one is already graded so we can watch the
-- needs_regrade trigger. B's closed submission carries photos A must never see.
insert into public.submissions (id, question_id, user_id, final_answer, steps_text, step_photo_paths,
                                auto_verdict, first_submitted_at)
values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222', '7', 'Langkah A kemarin',
   array['22222222-2222-2222-2222-222222222222/a-kemarin.jpg'], 'correct',
   (select release_at + interval '2 hours' from public.questions where id = 'a0000000-0000-0000-0000-000000000002')),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002',
   '33333333-3333-3333-3333-333333333333', '9', 'Langkah B kemarin',
   array['33333333-3333-3333-3333-333333333333/b-kemarin.jpg'], 'wrong',
   (select release_at + interval '3 hours' from public.questions where id = 'a0000000-0000-0000-0000-000000000002')),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', '42', 'Langkah awal',
   array['22222222-2222-2222-2222-222222222222/hari-ini.jpg'], 'needs_review',
   (select a_open_first from fx));

insert into public.grades (submission_id, is_correct, base_points, speed_points, steps_points,
                           private_feedback, graded_by, needs_regrade)
values
  ('b0000000-0000-0000-0000-000000000001', true, 6, 3, 2, 'Rapi sekali', '11111111-1111-1111-1111-111111111111', false),
  ('b0000000-0000-0000-0000-000000000002', false, 0, 0, 2, 'Periksa lagi langkahnya', '11111111-1111-1111-1111-111111111111', false),
  ('b0000000-0000-0000-0000-000000000003', true, 6, 3, 2, 'Bagus, tapi tulis langkah baru', '11111111-1111-1111-1111-111111111111', false);

select ok(
  (select release_at <= now() and now() < closes_at from public.questions
    where id = 'a0000000-0000-0000-0000-000000000001'),
  'prasyarat fixture: q_open sedang dalam jendela buka');
select ok(
  not has_function_privilege('authenticated', 'public.submit_answer(uuid,uuid,text,text,text[],text)', 'execute'),
  'submit_answer TIDAK bisa dieksekusi oleh authenticated (hanya jalur server)');
select ok(
  not has_function_privilege('anon', 'public.submit_answer(uuid,uuid,text,text,text[],text)', 'execute'),
  'submit_answer TIDAK bisa dieksekusi oleh anon');
select ok(
  has_function_privilege('service_role', 'public.submit_answer(uuid,uuid,text,text,text[],text)', 'execute'),
  'submit_answer bisa dieksekusi oleh service_role (server action)');

-- =============================================================================================
-- anon
-- =============================================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $q$ select public.submit_answer('22222222-2222-2222-2222-222222222222',
                                  'a0000000-0000-0000-0000-000000000001', '1', 'langkah', array[]::text[]) $q$,
  '42501', 'permission denied for function submit_answer',
  'anon: submit_answer ditolak pada level grant function');

-- =============================================================================================
-- Member A: read isolation (#3) and the read-only table surface (#5)
-- =============================================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select auth.uid()), '22222222-2222-2222-2222-222222222222'::uuid,
          'prasyarat: auth.uid() = member A');

select is((select count(*) from public.submissions), 2::bigint,
          'A hanya melihat 2 kirimannya sendiri');
select ok((select count(*) from public.submissions
            where user_id = '22222222-2222-2222-2222-222222222222') = 2,
          'kontrol: 2 kiriman milik A memang terlihat oleh A');
select is_empty(
  $q$ select 1 from public.submissions where user_id = '33333333-3333-3333-3333-333333333333' $q$,
  'A tidak bisa membaca kiriman milik B');
select is_empty(
  $q$ select step_photo_paths from public.submissions
       where user_id = '33333333-3333-3333-3333-333333333333' $q$,
  'A tidak bisa membaca foto langkah milik B');
select is_empty(
  $q$ select 1 from public.submissions where id = 'b0000000-0000-0000-0000-000000000002' $q$,
  'A tidak bisa membaca baris kiriman B lewat id langsung');

-- M-7: RLS filters rows, never columns, so the column-level grant is what keeps `auto_verdict` —
-- the pre-fill verdict of the locked answer — away from the member while the question is open.
select is((select final_answer from public.submissions
            where id = 'b0000000-0000-0000-0000-000000000003'), '42',
          'A masih bisa membaca kolom yang diizinkan pada kirimannya sendiri (halaman Hari Ini)');
select is((select step_photo_paths from public.submissions
            where id = 'b0000000-0000-0000-0000-000000000003'),
          array['22222222-2222-2222-2222-222222222222/hari-ini.jpg'],
          'kolom foto langkah juga masih terbaca oleh pemiliknya');
select throws_ok(
  $q$ select auto_verdict from public.submissions
       where user_id = '22222222-2222-2222-2222-222222222222' $q$,
  '42501', 'permission denied for table submissions',
  'A tidak bisa membaca auto_verdict miliknya sendiri selagi soal masih terbuka (M-7)');
select throws_ok(
  $q$ select * from public.submissions $q$,
  '42501', 'permission denied for table submissions',
  'select * pada submissions gagal di level grant, jadi PostgREST tidak bisa menyelundupkan auto_verdict');

select throws_ok(
  $q$ insert into public.submissions (question_id, user_id, final_answer, steps_text)
      values ('a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '1', 'x') $q$,
  '42501', 'permission denied for table submissions',
  'A tidak bisa INSERT ke submissions langsung');

select throws_ok(
  $q$ update public.submissions set final_answer = '99' where user_id = '22222222-2222-2222-2222-222222222222' $q$,
  '42501', 'permission denied for table submissions',
  'A tidak bisa UPDATE submissions langsung (termasuk barisnya sendiri)');

select throws_ok(
  $q$ delete from public.submissions where user_id = '22222222-2222-2222-2222-222222222222' $q$,
  '42501', 'permission denied for table submissions',
  'A tidak bisa DELETE submissions langsung');

-- The real protection against a forged verdict: a member cannot call the function at all, with any
-- combination of arguments (this is what replaces the old "auto_verdict never adds points" test).
select throws_ok(
  $q$ select public.submit_answer('22222222-2222-2222-2222-222222222222',
                                  'a0000000-0000-0000-0000-000000000001', '0', 'x',
                                  array[]::text[], 'correct') $q$,
  '42501', 'permission denied for function submit_answer',
  'A tidak bisa memanggil submit_answer langsung, jadi tidak bisa memalsukan auto_verdict');

-- M-7 hides the verdict from clients, not from the grading screen: the service role still reads it.
-- The column grant is role-based, so it applies to admins too — an admin's own JWT cannot read
-- `auto_verdict`, which is the tripwire for the grading queue in lib/actions/grading.ts: it has to
-- stay on the service-role client.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select ok(public.is_admin(), 'prasyarat: akun 1111... memang admin (jadi penolakan di bawah bukan soal RLS)');
select throws_ok(
  $q$ select auto_verdict from public.submissions $q$,
  '42501', 'permission denied for table submissions',
  'admin lewat klien JWT sendiri juga tidak bisa membaca auto_verdict (hanya service_role)');

reset role;
set local role service_role;
select is((select auto_verdict from public.submissions
            where id = 'b0000000-0000-0000-0000-000000000003'), 'needs_review',
          'service_role tetap bisa membaca auto_verdict (layar penilaian bergantung padanya)');
reset role;

-- =============================================================================================
-- The open window is decided by the database (#8), and deactivation (#9)
-- submit_answer is server-only now, so these call it the way the server action does: as
-- service_role, with an explicit p_user_id.
-- =============================================================================================
reset role;
set local role service_role;

select throws_ok(
  $q$ select public.submit_answer('33333333-3333-3333-3333-333333333333',
                                  'a0000000-0000-0000-0000-000000000002', '7', 'langkah', array[]::text[]) $q$,
  'P0001', 'Soal ini sudah ditutup',
  'B: kirim ke soal yang sudah ditutup ditolak dengan pesan Indonesia');

select throws_ok(
  $q$ select public.submit_answer('33333333-3333-3333-3333-333333333333',
                                  'a0000000-0000-0000-0000-000000000003', '9', 'langkah', array[]::text[]) $q$,
  'P0001', 'Soal ini belum dibuka',
  'B: kirim ke soal yang belum rilis ditolak dengan pesan Indonesia');

select throws_ok(
  $q$ select public.submit_answer('33333333-3333-3333-3333-333333333333',
                                  '99999999-9999-9999-9999-999999999999', '1', 'langkah', array[]::text[]) $q$,
  'P0001', 'Soal tidak ditemukan',
  'B: soal yang tidak ada ditolak');

-- A also has a row on the closed question: the window error wins over the answer lock.
reset role;
set local role service_role;
select throws_ok(
  $q$ select public.submit_answer('22222222-2222-2222-2222-222222222222',
                                  'a0000000-0000-0000-0000-000000000002', '999', 'langkah', array[]::text[]) $q$,
  'P0001', 'Soal ini sudah ditutup',
  'A: soal tertutup ditolak lebih dulu daripada kunci jawaban');

-- Deactivated member
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select ok(not public.is_active_member(), 'prasyarat: anggota nonaktif is_active_member() = false');
reset role;
set local role service_role;
select throws_ok(
  $q$ select public.submit_answer('44444444-4444-4444-4444-444444444444',
                                  'a0000000-0000-0000-0000-000000000001', '1', 'langkah', array[]::text[]) $q$,
  'P0001', 'Akun Anda tidak aktif',
  'anggota nonaktif tidak bisa mengirim jawaban');

select is_empty($q$ select 1 from public.submissions where user_id = '44444444-4444-4444-4444-444444444444' $q$,
                'kontrol: anggota nonaktif tidak punya kiriman di soal terbuka');

-- Missing user id (a server bug, not a client one): must be rejected instead of writing a row with
-- a NULL owner.
reset role;
set local role service_role;
select throws_ok(
  $q$ select public.submit_answer(null, 'a0000000-0000-0000-0000-000000000001', '1', 'langkah', array[]::text[]) $q$,
  'P0001', 'Anda harus masuk untuk mengirim jawaban',
  'tanpa user id: submit_answer ditolak alih-alih menulis baris tanpa pemilik');

-- =============================================================================================
-- Input validation (#10) and photo paths (#11) — all as member B, all must fail, no row created
-- =============================================================================================
reset role;
set local role service_role;

select throws_ok(
  $q$ select public.submit_answer('33333333-3333-3333-3333-333333333333',
                                  'a0000000-0000-0000-0000-000000000001', '   ', 'langkah', array[]::text[]) $q$,
  'P0001', 'Jawaban akhir wajib diisi',
  'B: jawaban kosong (hanya spasi) ditolak');

select throws_ok(
  $q$ select public.submit_answer('33333333-3333-3333-3333-333333333333',
                                  'a0000000-0000-0000-0000-000000000001', repeat('9', 501), 'langkah', array[]::text[]) $q$,
  'P0001', 'Jawaban akhir maksimal 500 karakter',
  'B: jawaban 501 karakter ditolak');

select throws_ok(
  $q$ select public.submit_answer('33333333-3333-3333-3333-333333333333',
                                  'a0000000-0000-0000-0000-000000000001', '7', '   ', array[]::text[]) $q$,
  'P0001', 'Langkah pengerjaan wajib diisi (foto atau teks)',
  'B: langkah kosong (teks dan foto) ditolak');

select throws_ok(
  $q$ select public.submit_answer('33333333-3333-3333-3333-333333333333',
      'a0000000-0000-0000-0000-000000000001', '7', null,
      array['33333333-3333-3333-3333-333333333333/1.jpg',
            '33333333-3333-3333-3333-333333333333/2.jpg',
            '33333333-3333-3333-3333-333333333333/3.jpg',
            '33333333-3333-3333-3333-333333333333/4.jpg',
            '33333333-3333-3333-3333-333333333333/5.jpg',
            '33333333-3333-3333-3333-333333333333/6.jpg']) $q$,
  'P0001', 'Maksimal 5 foto langkah pengerjaan',
  'B: lebih dari 5 foto ditolak');

select throws_ok(
  $q$ select public.submit_answer('33333333-3333-3333-3333-333333333333',
      'a0000000-0000-0000-0000-000000000001', '7', null,
      array['22222222-2222-2222-2222-222222222222/curang.jpg']) $q$,
  'P0001', 'Lokasi foto tidak valid',
  'B: path foto di folder milik A ditolak');

select throws_ok(
  $q$ select public.submit_answer('33333333-3333-3333-3333-333333333333',
      'a0000000-0000-0000-0000-000000000001', '7', null,
      array['langkah-b.jpg']) $q$,
  'P0001', 'Lokasi foto tidak valid',
  'B: path foto tanpa prefix user id ditolak');

select throws_ok(
  $q$ select public.submit_answer('33333333-3333-3333-3333-333333333333',
      'a0000000-0000-0000-0000-000000000001', '7', null,
      array['33333333-3333-3333-3333-333333333333/ok.jpg', null]) $q$,
  'P0001', 'Lokasi foto tidak valid',
  'B: elemen path foto NULL ditolak');

select is((select count(*) from public.submissions
            where user_id = '33333333-3333-3333-3333-333333333333'),
          1::bigint,
          'kontrol: semua kiriman B yang gagal tidak meninggalkan baris (masih hanya 1 baris fixture)');
select is((select question_id from public.submissions
            where user_id = '33333333-3333-3333-3333-333333333333'),
          'a0000000-0000-0000-0000-000000000002'::uuid,
          'kontrol: baris B yang ada hanyalah fixture soal kemarin');

-- =============================================================================================
-- B's first (and only) submit: p_user_id comes from the trusted server action, trimming,
-- auto_verdict normalisation (#12)
-- =============================================================================================
reset role;
set local role service_role;
select public.submit_answer('33333333-3333-3333-3333-333333333333',
                            'a0000000-0000-0000-0000-000000000001', ' 7 ', null,
                            array['33333333-3333-3333-3333-333333333333/langkah-b.jpg'], 'banana') as b_sub_id \gset

reset role;
select is((select user_id from public.submissions where id = :'b_sub_id'),
          '33333333-3333-3333-3333-333333333333'::uuid,
          'baris yang tersimpan memakai p_user_id yang diberikan pemanggil tepercaya');
select is((select final_answer from public.submissions where id = :'b_sub_id'), '7',
          'jawaban disimpan setelah di-trim');
select is((select auto_verdict from public.submissions where id = :'b_sub_id'), 'needs_review',
          'auto_verdict di luar nilai yang dikenal menjadi needs_review');
select is(
  (select count(*) from public.grades g join public.submissions s on s.id = g.submission_id
    where s.user_id = '33333333-3333-3333-3333-333333333333'
      and s.question_id = 'a0000000-0000-0000-0000-000000000001'),
  0::bigint,
  'kiriman pertama tidak membuat baris grades (auto_verdict tidak pernah menambah poin)');
select is((select count(*) from public.submissions
            where user_id = '33333333-3333-3333-3333-333333333333'), 2::bigint,
          'B punya 2 kiriman: fixture soal kemarin + soal hari ini');

-- =============================================================================================
-- Member C: boundary cases that must succeed — 500 characters, own photo folder
-- =============================================================================================
reset role;
set local role service_role;
select public.submit_answer('55555555-5555-5555-5555-555555555555',
                            'a0000000-0000-0000-0000-000000000001', repeat('9', 500), null,
                            array['55555555-5555-5555-5555-555555555555/langkah-c.jpg'], 'correct') as c_sub_id \gset

reset role;
select is((select user_id from public.submissions where id = :'c_sub_id'),
          '55555555-5555-5555-5555-555555555555'::uuid,
          'C mengirim sebagai dirinya sendiri');
select is((select char_length(final_answer) from public.submissions where id = :'c_sub_id'), 500,
          'jawaban tepat 500 karakter diterima');
select is((select step_photo_paths from public.submissions where id = :'c_sub_id'),
          array['55555555-5555-5555-5555-555555555555/langkah-c.jpg'], 'foto di folder sendiri tersimpan');
select is(
  (select count(*) from public.grades g join public.submissions s on s.id = g.submission_id
    where s.user_id = '55555555-5555-5555-5555-555555555555'),
  0::bigint,
  'auto_verdict = correct tetap tidak menambah poin tanpa penilaian admin');

-- C now tries to change the locked answer
reset role;
set local role service_role;
select throws_ok(
  $q$ select public.submit_answer('55555555-5555-5555-5555-555555555555',
                                  'a0000000-0000-0000-0000-000000000001', '1', 'langkah', array[]::text[]) $q$,
  'P0001', 'Jawaban akhir tidak bisa diubah setelah dikirim',
  'C: jawaban akhir terkunci setelah kiriman pertama');

-- =============================================================================================
-- A's edit path: answer locked, steps editable, first_submitted_at frozen, needs_regrade (#7, #14)
-- =============================================================================================
reset role;
select is((select needs_regrade from public.grades where submission_id = 'b0000000-0000-0000-0000-000000000003'),
          false, 'prasyarat: nilai A belum ditandai perlu dinilai ulang');

set local role service_role;

select throws_ok(
  $q$ select public.submit_answer('22222222-2222-2222-2222-222222222222',
                                  'a0000000-0000-0000-0000-000000000001', '43', 'langkah', array[]::text[]) $q$,
  'P0001', 'Jawaban akhir tidak bisa diubah setelah dikirim',
  'A: jawaban akhir tidak bisa berubah pada kiriman kedua');

select lives_ok(
  $q$ select public.submit_answer('22222222-2222-2222-2222-222222222222',
                                  'a0000000-0000-0000-0000-000000000001', '42', 'Langkah baru', array[]::text[]) $q$,
  'A: langkah pengerjaan masih bisa diedit selama soal belum ditutup');

reset role;
select is((select steps_text from public.submissions where id = 'b0000000-0000-0000-0000-000000000003'),
          'Langkah baru', 'langkah pengerjaan A tersimpan setelah edit');
select is((select final_answer from public.submissions where id = 'b0000000-0000-0000-0000-000000000003'),
          '42', 'jawaban akhir A tidak berubah setelah edit langkah');
select is((select first_submitted_at from public.submissions where id = 'b0000000-0000-0000-0000-000000000003'),
          (select a_open_first from fx),
          'first_submitted_at tidak berubah setelah edit langkah');
select ok(
  (select updated_at >= first_submitted_at from public.submissions
    where id = 'b0000000-0000-0000-0000-000000000003'),
  'updated_at bergerak maju, first_submitted_at tetap');
select is((select needs_regrade from public.grades where submission_id = 'b0000000-0000-0000-0000-000000000003'),
          true, 'mengubah langkah setelah dinilai menandai needs_regrade = true');

-- The flag must only fire on a real change.
update public.grades set needs_regrade = false where submission_id = 'b0000000-0000-0000-0000-000000000003';

set local role service_role;
select lives_ok(
  $q$ select public.submit_answer('22222222-2222-2222-2222-222222222222',
                                  'a0000000-0000-0000-0000-000000000001', '42', 'Langkah baru', array[]::text[]) $q$,
  'A: kiriman ulang tanpa perubahan isi tetap diterima');
reset role;
select is((select needs_regrade from public.grades where submission_id = 'b0000000-0000-0000-0000-000000000003'),
          false, 'kiriman tanpa perubahan langkah tidak menandai needs_regrade');

-- Trimming means " 42 " is still the same (locked) answer: accepted, and stored unchanged.
set local role service_role;
select lives_ok(
  $q$ select public.submit_answer('22222222-2222-2222-2222-222222222222',
                                  'a0000000-0000-0000-0000-000000000001', '  42  ', 'Langkah baru', array[]::text[]) $q$,
  'A: jawaban terkunci dibandingkan setelah trim, bukan per karakter mentah');
reset role;
select is((select final_answer from public.submissions where id = 'b0000000-0000-0000-0000-000000000003'),
          '42', 'jawaban tersimpan tetap bentuk yang sudah di-trim');

-- =============================================================================================
-- Re-check isolation after B and C also have rows on the open question
-- =============================================================================================
select is((select count(*) from public.submissions), 5::bigint,
          'kontrol: ada 5 baris di tabel submissions (A, B, C)');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*) from public.submissions), 2::bigint,
          'A tetap hanya melihat 2 kiriman setelah B dan C ikut mengirim di soal yang sama');
select is_empty(
  $q$ select 1 from public.submissions where user_id = '55555555-5555-5555-5555-555555555555' $q$,
  'A tidak bisa membaca kiriman C di soal yang sama');

select * from finish();
rollback;
