-- 06_storage.sql — checklist docs/SECURITY.md #17
--   "Storage: anon reads only released question-media; a member reads only their own
--    submission-media and cannot upload into another member's folder, a non-image MIME, or an
--    object over 8 MB"
-- plus: both buckets stay private, only two buckets exist, admin writes question-media, the admin
-- upload path is the service role, and RLS on storage.objects is enabled at all.
--
-- Actors: admin 1111..., member A 2222..., member B 3333..., inactive 4444...
-- Questions: q_open a0..01 (image open/diagram.png), q_closed a0..02 (closed/diagram.png),
--            q_future a0..03 (future/diagram.png, not released)
-- Objects: B already owns a photo in submission-media; A owns none.

begin;
set search_path = extensions, public;
select plan(34);

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
update public.profiles set active = false where id = '44444444-4444-4444-4444-444444444444';

insert into public.questions (id, release_date, title, body_latex, image_path, topic, difficulty, created_by)
select 'a0000000-0000-0000-0000-000000000001', fx.open_date, 'Soal hari ini', '1+1=?', 'open/diagram.png', 'aljabar', 2,
       '11111111-1111-1111-1111-111111111111' from fx;
insert into public.questions (id, release_date, title, body_latex, image_path, topic, difficulty, created_by)
select 'a0000000-0000-0000-0000-000000000002', fx.closed_date, 'Soal kemarin', '2+2=?', 'closed/diagram.png', 'geometri', 3,
       '11111111-1111-1111-1111-111111111111' from fx;
insert into public.questions (id, release_date, title, body_latex, image_path, topic, difficulty, created_by)
select 'a0000000-0000-0000-0000-000000000003', fx.future_date, 'Soal besok', '3+3=?', 'future/diagram.png', 'bilangan', 1,
       '11111111-1111-1111-1111-111111111111' from fx;

insert into storage.objects (bucket_id, name, owner, metadata)
values
  ('question-media', 'open/diagram.png', '11111111-1111-1111-1111-111111111111',
   '{"mimetype":"image/jpeg","size":1000}'::jsonb),
  ('question-media', 'closed/diagram.png', '11111111-1111-1111-1111-111111111111',
   '{"mimetype":"image/png","size":2000}'::jsonb),
  ('question-media', 'future/diagram.png', '11111111-1111-1111-1111-111111111111',
   '{"mimetype":"image/webp","size":3000}'::jsonb),
  ('submission-media', '33333333-3333-3333-3333-333333333333/foto-b.jpg',
   '33333333-3333-3333-3333-333333333333', '{"mimetype":"image/jpeg","size":4000}'::jsonb);

-- =============================================================================================
-- Bucket configuration and the RLS guard on storage.objects
-- =============================================================================================
select is((select count(*) from storage.buckets), 2::bigint,
          'hanya ada dua bucket (tidak ada bucket untuk tamu)');
select ok(
  (select bool_and(not public) from storage.buckets where id in ('question-media', 'submission-media')),
  'kedua bucket privat (public = false)');
select ok(
  (select bool_and(file_size_limit = 8388608) from storage.buckets
    where id in ('question-media', 'submission-media')),
  'batas ukuran objek 8 MB di kedua bucket');
select ok(
  (select bool_and(allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']
                   and allowed_mime_types <@ array['image/jpeg', 'image/png', 'image/webp'])
   from storage.buckets where id in ('question-media', 'submission-media')),
  'MIME yang diizinkan hanya jpeg, png, webp');
select ok((select relrowsecurity from pg_class where oid = 'storage.objects'::regclass),
          'RLS aktif pada storage.objects (semua policy di bawah bergantung padanya)');

-- =============================================================================================
-- Guest (anon)
-- =============================================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*) from storage.objects where bucket_id = 'question-media'), 2::bigint,
          'anon hanya melihat gambar soal yang sudah rilis');
select is_empty($q$ select 1 from storage.objects
                 where bucket_id = 'question-media' and name = 'future/diagram.png' $q$,
                'anon tidak bisa melihat gambar soal yang belum rilis');
select is_empty($q$ select 1 from storage.objects where bucket_id = 'submission-media' $q$,
                'anon tidak melihat satu pun foto kiriman');
select throws_ok($q$ insert into storage.objects (bucket_id, name, metadata)
                    values ('submission-media', '22222222-2222-2222-2222-222222222222/x.jpg',
                            '{"mimetype":"image/jpeg","size":1000}'::jsonb) $q$,
                 '42501', 'new row violates row-level security policy for table "objects"',
                 'anon tidak bisa mengunggah ke submission-media');
select throws_ok($q$ insert into storage.objects (bucket_id, name, metadata)
                    values ('question-media', 'open/hack.png', '{"mimetype":"image/png","size":10}'::jsonb) $q$,
                 '42501', 'new row violates row-level security policy for table "objects"',
                 'anon tidak bisa mengunggah ke question-media');

-- =============================================================================================
-- Member A
-- =============================================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select count(*) from storage.objects where bucket_id = 'question-media'), 2::bigint,
          'member melihat gambar soal yang sudah rilis saja');
select is_empty($q$ select 1 from storage.objects
                 where bucket_id = 'question-media' and name = 'future/diagram.png' $q$,
                'member tidak bisa melihat gambar soal yang belum rilis');
select is_empty($q$ select 1 from storage.objects where bucket_id = 'submission-media' $q$,
                'A belum punya foto, dan tidak melihat foto B');
select is_empty($q$ select 1 from storage.objects
                 where name = '33333333-3333-3333-3333-333333333333/foto-b.jpg' $q$,
                'A tidak bisa membaca foto langkah milik B');

select lives_ok($q$ insert into storage.objects (bucket_id, name, owner, metadata)
                  values ('submission-media', '22222222-2222-2222-2222-222222222222/langkah-1.jpg',
                          '22222222-2222-2222-2222-222222222222',
                          '{"mimetype":"image/jpeg","size":1000}'::jsonb) $q$,
                'A bisa mengunggah foto ke foldernya sendiri');
select is((select count(*) from storage.objects where bucket_id = 'submission-media'), 1::bigint,
          'A sekarang melihat fotonya sendiri');

select throws_ok($q$ insert into storage.objects (bucket_id, name, owner, metadata)
                    values ('submission-media', '33333333-3333-3333-3333-333333333333/selundup.jpg',
                            '22222222-2222-2222-2222-222222222222',
                            '{"mimetype":"image/jpeg","size":1000}'::jsonb) $q$,
                 '42501', 'new row violates row-level security policy for table "objects"',
                 'A tidak bisa mengunggah ke folder milik B');
select throws_ok($q$ insert into storage.objects (bucket_id, name, owner, metadata)
                    values ('submission-media', '22222222-2222-2222-2222-222222222222/dokumen.pdf',
                            '22222222-2222-2222-2222-222222222222',
                            '{"mimetype":"application/pdf","size":1000}'::jsonb) $q$,
                 '42501', 'new row violates row-level security policy for table "objects"',
                 'A tidak bisa mengunggah MIME yang bukan gambar');
select throws_ok($q$ insert into storage.objects (bucket_id, name, owner, metadata)
                    values ('submission-media', '22222222-2222-2222-2222-222222222222/besar.jpg',
                            '22222222-2222-2222-2222-222222222222',
                            '{"mimetype":"image/jpeg","size":8388609}'::jsonb) $q$,
                 '42501', 'new row violates row-level security policy for table "objects"',
                 'A tidak bisa mengunggah objek lebih dari 8 MB');
select lives_ok($q$ insert into storage.objects (bucket_id, name, owner, metadata)
                  values ('submission-media', '22222222-2222-2222-2222-222222222222/tepat-8mb.jpg',
                          '22222222-2222-2222-2222-222222222222',
                          '{"mimetype":"image/jpeg","size":8388608}'::jsonb) $q$,
                'tepat 8 MB masih diterima (batas inklusif)');
select throws_ok($q$ insert into storage.objects (bucket_id, name, owner, metadata)
                    values ('question-media', 'open/dari-member.png',
                            '22222222-2222-2222-2222-222222222222',
                            '{"mimetype":"image/png","size":1000}'::jsonb) $q$,
                 '42501', 'new row violates row-level security policy for table "objects"',
                 'A tidak bisa mengunggah ke question-media (hanya admin)');

select is_empty($q$ update storage.objects set metadata = '{"mimetype":"image/png","size":5}'::jsonb
                 where name = '33333333-3333-3333-3333-333333333333/foto-b.jpg' returning 1 $q$,
                'A tidak bisa memperbarui objek milik B');
select is_empty($q$ update storage.objects set metadata = '{"mimetype":"image/png","size":5}'::jsonb
                 where bucket_id = 'question-media' returning 1 $q$,
                'A tidak bisa memperbarui gambar soal');
select lives_ok($q$ update storage.objects set metadata = '{"mimetype":"image/jpeg","size":2000}'::jsonb
                  where name = '22222222-2222-2222-2222-222222222222/langkah-1.jpg' $q$,
                'A bisa memperbarui objeknya sendiri (upsert saat kirim ulang)');
select throws_ok($q$ update storage.objects set metadata = '{"mimetype":"application/pdf","size":2000}'::jsonb
                    where name = '22222222-2222-2222-2222-222222222222/langkah-1.jpg' $q$,
                 '42501', 'new row violates row-level security policy for table "objects"',
                 'A tidak bisa mengubah objeknya sendiri menjadi MIME non-gambar');
select throws_ok($q$ delete from storage.objects
                    where name = '22222222-2222-2222-2222-222222222222/langkah-1.jpg' $q$,
                 '42501', null,
                 'A tidak bisa menghapus objeknya sendiri (tidak ada policy delete, Storage yang mengurus)');

-- =============================================================================================
-- Deactivated member: no upload at all
-- =============================================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);

select throws_ok($q$ insert into storage.objects (bucket_id, name, owner, metadata)
                    values ('submission-media', '44444444-4444-4444-4444-444444444444/x.jpg',
                            '44444444-4444-4444-4444-444444444444',
                            '{"mimetype":"image/jpeg","size":1000}'::jsonb) $q$,
                 '42501', 'new row violates row-level security policy for table "objects"',
                 'anggota nonaktif tidak bisa mengunggah');

-- =============================================================================================
-- Admin and the server path
-- =============================================================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select count(*) from storage.objects where bucket_id = 'question-media'), 3::bigint,
          'admin melihat semua gambar soal, termasuk yang belum rilis');
select is((select count(*) from storage.objects where bucket_id = 'submission-media'), 3::bigint,
          'admin melihat foto kiriman semua anggota (1 milik B + 2 milik A)');
select lives_ok($q$ insert into storage.objects (bucket_id, name, owner, metadata)
                  values ('question-media', 'open/diagram-baru.png',
                          '11111111-1111-1111-1111-111111111111',
                          '{"mimetype":"image/png","size":1200}'::jsonb) $q$,
                'admin bisa mengunggah gambar soal');
select throws_ok($q$ insert into storage.objects (bucket_id, name, owner, metadata)
                    values ('question-media', 'open/dokumen.pdf',
                            '11111111-1111-1111-1111-111111111111',
                            '{"mimetype":"application/pdf","size":1200}'::jsonb) $q$,
                 '42501', 'new row violates row-level security policy for table "objects"',
                 'admin pun tidak bisa mengunggah MIME non-gambar');
select throws_ok($q$ insert into storage.objects (bucket_id, name, owner, metadata)
                    values ('question-media', 'open/besar.png',
                            '11111111-1111-1111-1111-111111111111',
                            '{"mimetype":"image/png","size":8388609}'::jsonb) $q$,
                 '42501', 'new row violates row-level security policy for table "objects"',
                 'admin pun tidak bisa mengunggah objek lebih dari 8 MB');
select throws_ok($q$ insert into storage.objects (bucket_id, name, owner, metadata)
                    values ('submission-media', '33333333-3333-3333-3333-333333333333/dari-admin.jpg',
                            '11111111-1111-1111-1111-111111111111',
                            '{"mimetype":"image/jpeg","size":1000}'::jsonb) $q$,
                 '42501', 'new row violates row-level security policy for table "objects"',
                 'admin tidak menulis ke folder anggota dari browser');

reset role;
set local role service_role;
select lives_ok($q$ insert into storage.objects (bucket_id, name, owner, metadata)
                  values ('submission-media', '33333333-3333-3333-3333-333333333333/dari-server.jpg',
                          '33333333-3333-3333-3333-333333333333',
                          '{"mimetype":"image/jpeg","size":1000}'::jsonb) $q$,
                'service_role bisa menulis objek storage (jalur server action / admin)');

select * from finish();
rollback;
