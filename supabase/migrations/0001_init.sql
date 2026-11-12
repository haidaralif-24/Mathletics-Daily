-- 0001_init.sql
-- Mathletics Daily: initial schema, RLS policies, functions, triggers and storage buckets.
--
-- Requirement IDs covered: A-3, A-5, S-1, S-5, M-1, M-2, M-3, M-4, M-7, G-2, G-3, G-4, H-2,
--                         Q-1..Q-5, R-2, R-3, R-6, R-7, L-1, L-2, L-5, U-1..U-3
-- Schema reference: docs/DATA_MODEL.md · RLS rules: docs/SECURITY.md · points: docs/SCORING.md
--
-- Hard rules honoured here:
--   * RLS on every table; members are read-only on every table (writes go through `submit_answer`
--     or through server actions holding the service role key).
--   * Time decisions come from `now()` in the database (release_at / closes_at are generated).
--   * Sensitive columns live in their own tables (question_keys, question_markschemes,
--     question_solutions), because RLS cannot restrict columns.
--   * Every helper function is `security definer`, `stable`, `set search_path = ''` and fully
--     schema-qualified, and EXECUTE is revoked from `public`/`anon` unless a client needs it.

-- ---------------------------------------------------------------------------------------------
-- 0. Test tooling
--
-- pgTAP is what `pnpm db:test` runs the RLS suite with (docs/TESTING.md). Installing it here means
-- the suite works on a freshly reset database with no extra setup.
-- ---------------------------------------------------------------------------------------------

create extension if not exists pgtap with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  class_name text,
  role text not null default 'member' check (role in ('member', 'admin')),
  active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Single-row table (id is a boolean that must be true, so at most one row can exist).
create table public.app_settings (
  id boolean primary key default true check (id),
  osn_date date,
  updated_at timestamptz not null default now()
);

insert into public.app_settings default values;

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  release_date date not null unique,
  -- 04:00 WIB on release_date. `timestamp AT TIME ZONE 'Asia/Jakarta'` interprets the wall clock
  -- as WIB and yields the timestamptz instant; WIB is UTC+7 with no DST.
  release_at timestamptz generated always as (
    (release_date::timestamp + interval '4 hours') at time zone 'Asia/Jakarta'
  ) stored,
  -- closes_at = release_at + 24 h. Written from release_date (04:00 + 24 h = 04:00 next day,
  -- i.e. +28 h of wall clock) so this column does not depend on another generated column.
  closes_at timestamptz generated always as (
    (release_date::timestamp + interval '28 hours') at time zone 'Asia/Jakarta'
  ) stored,
  title text not null,
  body_latex text not null,
  image_path text,
  topic text,
  difficulty smallint check (difficulty between 1 and 5),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Answer keys: never readable through the API by any client role (docs/SECURITY.md).
create table public.question_keys (
  question_id uuid primary key references public.questions (id) on delete cascade,
  answer_type text not null default 'integer' check (answer_type in ('integer', 'fraction', 'decimal', 'text')),
  accepted_answers text[] not null,
  tolerance numeric,
  created_at timestamptz not null default now()
);

-- Mark scheme: never readable through the API by any client role.
create table public.question_markschemes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  position smallint not null,
  description_md text not null,
  points smallint not null check (points >= 0),
  unique (question_id, position)
);

-- Worked solution: readable only after the question has closed (Q-5, G-2, H-2).
create table public.question_solutions (
  question_id uuid primary key references public.questions (id) on delete cascade,
  solution_md text not null,
  publish_markscheme boolean not null default false
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  final_answer text not null,
  steps_text text,
  step_photo_paths text[] not null default '{}',
  auto_verdict text check (auto_verdict in ('correct', 'wrong', 'needs_review')),
  first_submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, user_id)
);

create table public.grades (
  submission_id uuid primary key references public.submissions (id) on delete cascade,
  is_correct boolean not null,
  base_points numeric(4, 1) not null default 0,
  speed_points numeric(4, 1) not null default 0,
  steps_points numeric(4, 1) not null default 0,
  total_points numeric(4, 1) generated always as (base_points + speed_points + steps_points) stored,
  criteria_ticks jsonb not null default '[]'::jsonb check (jsonb_typeof(criteria_ticks) = 'array'),
  private_feedback text,
  graded_by uuid references auth.users (id),
  graded_at timestamptz not null default now(),
  needs_regrade boolean not null default false
);

create index submissions_question_id_idx on public.submissions (question_id);
create index submissions_user_id_idx on public.submissions (user_id);
create index questions_release_at_idx on public.questions (release_at);

-- ---------------------------------------------------------------------------------------------
-- 2. Helper functions (security definer + stable + empty search_path)
--
-- Defined before the policies that call them.
-- ---------------------------------------------------------------------------------------------

-- Used inside policies. security definer so the lookup on profiles never re-enters profile RLS.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and active = true
  );
$$;

create function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and active = true
  );
$$;

create function public.get_osn_date()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select osn_date from public.app_settings where id = true;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Row level security
--
-- Model (docs/SECURITY.md): every table is read-only for client roles. Reads are granted where a
-- screen needs them; all writes happen through `submit_answer` (members) or the service role
-- (admins, in server actions). There is deliberately NO insert/update/delete policy for `anon` or
-- `authenticated` on any table: an UPDATE also needs a SELECT policy, so admin writes could never
-- be column-scoped through RLS anyway. Buckets and functions are the only client-side write paths.
-- ---------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.questions enable row level security;
alter table public.question_keys enable row level security;
alter table public.question_markschemes enable row level security;
alter table public.question_solutions enable row level security;
alter table public.submissions enable row level security;
alter table public.grades enable row level security;

-- profiles: your own row, or everything if you are an admin (A-7, U-2). No client write at all:
-- name, class, role and active are admin-managed (DECISIONS 18).
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (public.is_admin());

-- app_settings: admins only. Members read the date through get_osn_date() (S-6, U-3).
create policy app_settings_select_admin on public.app_settings
  for select to authenticated
  using (public.is_admin());

-- questions: released ones for everyone, everything for admins (S-5).
create policy questions_select_released on public.questions
  for select to anon, authenticated
  using (release_at <= now());

create policy questions_select_admin on public.questions
  for select to authenticated
  using (public.is_admin());

-- question_keys / question_markschemes: RLS on, no policy at all. Nothing reaches a client.
-- Admins read them inside server actions holding the service role key.

-- question_solutions: readable by anyone, but only once the question has closed (Q-5, H-2).
create policy question_solutions_select_closed on public.question_solutions
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.questions q
      where q.id = question_id
        and q.closes_at <= now()
    )
  );

create policy question_solutions_select_admin on public.question_solutions
  for select to authenticated
  using (public.is_admin());

-- submissions: your own row, or everything if you are an admin (M-7, L-5). Writes only via
-- `submit_answer`; the unique (question_id, user_id) plus that function keep the answer locked.
create policy submissions_select_own on public.submissions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy submissions_select_admin on public.submissions
  for select to authenticated
  using (public.is_admin());

-- grades: your own grade, and only after the question has closed (M-7). Admins see everything.
create policy grades_select_own_closed on public.grades
  for select to authenticated
  using (
    exists (
      select 1
      from public.submissions s
      join public.questions q on q.id = s.question_id
      where s.id = grades.submission_id
        and s.user_id = (select auth.uid())
        and q.closes_at <= now()
    )
  );

create policy grades_select_admin on public.grades
  for select to authenticated
  using (public.is_admin());

-- Table privileges: keep the client surface minimal and independent of Supabase's default grants.
revoke all on table public.profiles,
  public.app_settings,
  public.questions,
  public.question_keys,
  public.question_markschemes,
  public.question_solutions,
  public.submissions,
  public.grades
  from anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;

-- Public (guest) surface: released questions and closed solutions only. Signed-in callers need the
-- same grants, plus their own profile, own submissions and own (closed) grade.
-- question_keys and question_markschemes get no SELECT grant for any client role at all.
grant select on table public.questions, public.question_solutions to anon, authenticated;
grant select on table public.profiles, public.app_settings, public.submissions, public.grades
  to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. submit_answer: the only way a member writes a submission (M-1..M-5, S-1, A-5)
-- ---------------------------------------------------------------------------------------------

create function public.submit_answer(
  p_question_id uuid,
  p_final_answer text,
  p_steps_text text,
  p_photo_paths text[],
  p_auto_verdict text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_active boolean;
  v_question public.questions%rowtype;
  v_answer text := btrim(coalesce(p_final_answer, ''));
  v_steps text := nullif(btrim(coalesce(p_steps_text, '')), '');
  v_photos text[] := coalesce(p_photo_paths, '{}'::text[]);
  v_verdict text := p_auto_verdict;
  v_existing public.submissions%rowtype;
  v_id uuid;
  v_path text;
begin
  -- Identity always comes from the JWT, never from a parameter.
  if v_uid is null then
    raise exception 'Anda harus masuk untuk mengirim jawaban';
  end if;

  select p.active into v_active from public.profiles p where p.id = v_uid;
  if v_active is null then
    raise exception 'Profil tidak ditemukan';
  end if;
  if not v_active then
    raise exception 'Akun Anda tidak aktif';
  end if;

  -- The window is read from the questions table, never from the caller.
  select * into v_question from public.questions q where q.id = p_question_id;
  if not found then
    raise exception 'Soal tidak ditemukan';
  end if;

  if now() < v_question.release_at then
    raise exception 'Soal ini belum dibuka';
  end if;
  if now() >= v_question.closes_at then
    raise exception 'Soal ini sudah ditutup';
  end if;

  if v_answer = '' then
    raise exception 'Jawaban akhir wajib diisi';
  end if;
  if char_length(v_answer) > 500 then
    raise exception 'Jawaban akhir maksimal 500 karakter';
  end if;

  -- Steps are required: typed text and/or photos.
  if v_steps is null and cardinality(v_photos) = 0 then
    raise exception 'Langkah pengerjaan wajib diisi (foto atau teks)';
  end if;

  if cardinality(v_photos) > 5 then
    raise exception 'Maksimal 5 foto langkah pengerjaan';
  end if;

  -- A photo path must live in the caller's own storage folder (defence in depth on top of the
  -- storage.objects policies).
  foreach v_path in array v_photos loop
    if v_path is null or not starts_with(v_path, v_uid::text || '/') then
      raise exception 'Lokasi foto tidak valid';
    end if;
  end loop;

  -- Pre-fill for the admin only; unknown values become needs_review and never affect points.
  if v_verdict is not null and v_verdict not in ('correct', 'wrong', 'needs_review') then
    v_verdict := 'needs_review';
  end if;

  select * into v_existing
  from public.submissions s
  where s.question_id = p_question_id
    and s.user_id = v_uid
  for update;

  if found then
    -- The final answer is locked after the first submit (M-3).
    if v_existing.final_answer is distinct from v_answer then
      raise exception 'Jawaban akhir tidak bisa diubah setelah dikirim';
    end if;
  else
    insert into public.submissions (
      question_id,
      user_id,
      final_answer,
      steps_text,
      step_photo_paths,
      auto_verdict,
      first_submitted_at
    )
    values (
      p_question_id,
      v_uid,
      v_answer,
      v_steps,
      v_photos,
      v_verdict,
      now()
    )
    on conflict (question_id, user_id) do nothing
    returning id into v_id;

    -- First submit wins.
    if v_id is not null then
      return v_id;
    end if;

    -- A concurrent first submit got there first; fall through and treat it as an edit.
    select * into v_existing
    from public.submissions s
    where s.question_id = p_question_id
      and s.user_id = v_uid
    for update;

    if v_existing.final_answer is distinct from v_answer then
      raise exception 'Jawaban akhir tidak bisa diubah setelah dikirim';
    end if;
  end if;

  -- Steps stay editable until closes_at; first_submitted_at and final_answer never move.
  update public.submissions s
  set steps_text = v_steps,
      step_photo_paths = v_photos,
      updated_at = now()
  where s.id = v_existing.id;

  return v_existing.id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. leaderboard (L-1, L-2, L-5)
-- ---------------------------------------------------------------------------------------------

create function public.leaderboard(p_period text default 'overall')
returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  class_name text,
  total_points numeric,
  correct_count bigint,
  attempted bigint,
  avg_submit_seconds numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_week_start date;
  v_week_end date;
begin
  if p_period is null or p_period not in ('overall', 'week') then
    raise exception 'Periode tidak dikenal: gunakan overall atau week';
  end if;

  -- Mon-Sun week in WIB that contains today; questions are grouped by release_date.
  if p_period = 'week' then
    v_week_start := date_trunc('week', (now() at time zone 'Asia/Jakarta')::date)::date;
    v_week_end := v_week_start + 6;
  end if;

  return query
  with scoped as (
    select s.id, s.user_id, s.first_submitted_at, q.release_at
    from public.submissions s
    join public.questions q on q.id = s.question_id
    where p_period = 'overall'
       or q.release_date between v_week_start and v_week_end
  ),
  agg as (
    select
      p.id as user_id,
      p.display_name,
      p.class_name,
      coalesce(sum(g.total_points), 0)::numeric as total_points,
      count(g.submission_id) filter (where g.is_correct) as correct_count,
      count(sc.id) as attempted,
      avg(extract(epoch from (sc.first_submitted_at - sc.release_at))) as avg_submit_seconds
    from public.profiles p
    left join scoped sc on sc.user_id = p.id
    left join public.grades g on g.submission_id = sc.id
    where p.role = 'member'
      and p.active = true
    group by p.id, p.display_name, p.class_name
  )
  select
    row_number() over (
      order by a.total_points desc,
               a.correct_count desc,
               a.avg_submit_seconds asc nulls last,
               a.display_name asc
    ) as rank,
    a.user_id,
    a.display_name,
    a.class_name,
    a.total_points,
    a.correct_count,
    a.attempted,
    a.avg_submit_seconds
  from agg a;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Triggers
-- ---------------------------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

-- A member who edits their steps after grading flags the grade for review (R-6, M-7).
create function public.flag_needs_regrade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.steps_text is distinct from old.steps_text
     or new.step_photo_paths is distinct from old.step_photo_paths then
    update public.grades g
    set needs_regrade = true
    where g.submission_id = new.id
      and g.needs_regrade = false;
  end if;
  return null;
end;
$$;

create trigger submissions_flag_needs_regrade
  after update on public.submissions
  for each row execute function public.flag_needs_regrade();

-- Every new auth user gets a member profile. Never an admin: promotion is an explicit admin action.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, role, active, must_change_password)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    'member',
    true,
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- 7. Function privileges
-- ---------------------------------------------------------------------------------------------

-- Helpers used by policies and screens: signed-in callers only.
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_active_member() from public, anon;
revoke execute on function public.get_osn_date() from public, anon;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_member() to authenticated;
grant execute on function public.get_osn_date() to authenticated;

-- Member write path and leaderboard: never reachable by guests.
revoke execute on function public.submit_answer(uuid, text, text, text[], text) from public, anon;
revoke execute on function public.leaderboard(text) from public, anon;

grant execute on function public.submit_answer(uuid, text, text, text[], text) to authenticated;
grant execute on function public.leaderboard(text) to authenticated;

-- Trigger functions are not API surface.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.flag_needs_regrade() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 8. Storage buckets and policies
--
-- Two private buckets, no third one: guests upload nothing (G-1, DECISIONS 8).
-- Allowed: image/jpeg, image/png, image/webp, at most 8 MB each.
-- ---------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('question-media', 'question-media', false, 8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('submission-media', 'submission-media', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- question-media: admins write; anyone reads a diagram once its question is released.
-- `questions.image_path` stores the object path inside the bucket (no bucket prefix).
create policy question_media_select_released on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'question-media'
    and exists (
      select 1
      from public.questions q
      where q.image_path = storage.objects.name
        and q.release_at <= now()
    )
  );

create policy question_media_select_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'question-media' and public.is_admin());

create policy question_media_insert_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'question-media'
    and public.is_admin()
    and coalesce(metadata ->> 'mimetype', '') in ('image/jpeg', 'image/png', 'image/webp')
    and coalesce((metadata ->> 'size')::bigint, 0) <= 8388608
  );

create policy question_media_update_admin on storage.objects
  for update to authenticated
  using (bucket_id = 'question-media' and public.is_admin())
  with check (
    bucket_id = 'question-media'
    and public.is_admin()
    and coalesce(metadata ->> 'mimetype', '') in ('image/jpeg', 'image/png', 'image/webp')
    and coalesce((metadata ->> 'size')::bigint, 0) <= 8388608
  );

create policy question_media_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'question-media' and public.is_admin());

-- submission-media: the owner writes into a folder named after their user id; owner and admin read.
create policy submission_media_select_own_or_admin on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submission-media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_admin()
    )
  );

create policy submission_media_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'submission-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_member()
    and coalesce(metadata ->> 'mimetype', '') in ('image/jpeg', 'image/png', 'image/webp')
    and coalesce((metadata ->> 'size')::bigint, 0) <= 8388608
  );

-- Upsert on retry needs insert + select + update (Supabase storage rule).
create policy submission_media_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'submission-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_member()
  )
  with check (
    bucket_id = 'submission-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_member()
    and coalesce(metadata ->> 'mimetype', '') in ('image/jpeg', 'image/png', 'image/webp')
    and coalesce((metadata ->> 'size')::bigint, 0) <= 8388608
  );
