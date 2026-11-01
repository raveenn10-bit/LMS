-- Lavindu Maneth Mathematics LMS schema for Supabase Free Tier.
-- All user-facing tables use strict RLS. Storage buckets are private.

create schema if not exists private;

create table if not exists public.lms_admin_invites (
  email text primary key check (email = lower(email)),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table if not exists public.lms_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lms_courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  grade text not null,
  medium text not null default 'Sinhala',
  description text not null default '',
  monthly_fee_lkr numeric(10,2) check (monthly_fee_lkr is null or monthly_fee_lkr >= 0),
  cover_color text not null default 'sage',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lms_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.lms_courses(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended', 'expired')),
  starts_at timestamptz,
  expires_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists public.lms_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.lms_courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  lesson_type text not null default 'recorded' check (lesson_type in ('live', 'recorded', 'note')),
  video_url text,
  meeting_url text,
  file_path text,
  scheduled_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lms_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.lms_courses(id) on delete cascade,
  billing_month date not null,
  amount_lkr numeric(10,2) not null check (amount_lkr >= 0),
  slip_path text not null,
  reference text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id, billing_month)
);

create table if not exists public.lms_lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lms_lessons(id) on delete cascade,
  completed boolean not null default false,
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists public.lms_announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.lms_courses(id) on delete cascade,
  title text not null,
  message text not null,
  is_published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.lms_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lms_enrollments_user_idx on public.lms_enrollments(user_id);
create index if not exists lms_enrollments_course_idx on public.lms_enrollments(course_id);
create index if not exists lms_lessons_course_order_idx on public.lms_lessons(course_id, sort_order);
create index if not exists lms_payments_user_status_idx on public.lms_payments(user_id, status);
create index if not exists lms_payments_course_month_idx on public.lms_payments(course_id, billing_month);

create or replace function private.is_lms_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lms_profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function private.handle_lms_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role text := 'student';
begin
  if exists (select 1 from public.lms_admin_invites where email = lower(new.email)) then
    assigned_role := 'admin';
    update public.lms_admin_invites set accepted_at = now() where email = lower(new.email);
  end if;

  insert into public.lms_profiles (id, email, full_name, phone, role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone',
    assigned_role
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone,
    role = case when public.lms_profiles.role = 'admin' then 'admin' else excluded.role end,
    updated_at = now();
  return new;
end;
$$;

create or replace function private.set_lms_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger lms_on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_lms_new_user();

create trigger lms_profiles_updated_at before update on public.lms_profiles
  for each row execute function private.set_lms_updated_at();
create trigger lms_courses_updated_at before update on public.lms_courses
  for each row execute function private.set_lms_updated_at();
create trigger lms_enrollments_updated_at before update on public.lms_enrollments
  for each row execute function private.set_lms_updated_at();
create trigger lms_lessons_updated_at before update on public.lms_lessons
  for each row execute function private.set_lms_updated_at();
create trigger lms_payments_updated_at before update on public.lms_payments
  for each row execute function private.set_lms_updated_at();

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke all on function private.is_lms_admin() from public, anon;
grant execute on function private.is_lms_admin() to authenticated;
revoke all on function private.handle_lms_new_user() from public, anon, authenticated;
revoke all on function private.set_lms_updated_at() from public, anon, authenticated;

alter table public.lms_admin_invites enable row level security;
alter table public.lms_profiles enable row level security;
alter table public.lms_courses enable row level security;
alter table public.lms_enrollments enable row level security;
alter table public.lms_lessons enable row level security;
alter table public.lms_payments enable row level security;
alter table public.lms_lesson_progress enable row level security;
alter table public.lms_announcements enable row level security;
alter table public.lms_audit_logs enable row level security;

create policy "lms_admin_invites_admin_all" on public.lms_admin_invites
  for all to authenticated using ((select private.is_lms_admin()))
  with check ((select private.is_lms_admin()));

create policy "lms_profiles_select_own" on public.lms_profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "lms_profiles_update_own" on public.lms_profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy "lms_profiles_admin_all" on public.lms_profiles
  for all to authenticated using ((select private.is_lms_admin()))
  with check ((select private.is_lms_admin()));

create policy "lms_courses_public_active" on public.lms_courses
  for select to anon, authenticated using (is_active);
create policy "lms_courses_admin_all" on public.lms_courses
  for all to authenticated using ((select private.is_lms_admin()))
  with check ((select private.is_lms_admin()));

create policy "lms_enrollments_select_own" on public.lms_enrollments
  for select to authenticated using (user_id = (select auth.uid()));
create policy "lms_enrollments_insert_own" on public.lms_enrollments
  for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending');
create policy "lms_enrollments_admin_all" on public.lms_enrollments
  for all to authenticated using ((select private.is_lms_admin()))
  with check ((select private.is_lms_admin()));

create policy "lms_lessons_enrolled_read" on public.lms_lessons
  for select to authenticated using (
    is_published and exists (
      select 1 from public.lms_enrollments e
      where e.course_id = lms_lessons.course_id
        and e.user_id = (select auth.uid())
        and e.status = 'approved'
        and (e.starts_at is null or e.starts_at <= now())
        and (e.expires_at is null or e.expires_at > now())
    )
  );
create policy "lms_lessons_admin_all" on public.lms_lessons
  for all to authenticated using ((select private.is_lms_admin()))
  with check ((select private.is_lms_admin()));

create policy "lms_payments_select_own" on public.lms_payments
  for select to authenticated using (user_id = (select auth.uid()));
create policy "lms_payments_insert_own" on public.lms_payments
  for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending');
create policy "lms_payments_admin_all" on public.lms_payments
  for all to authenticated using ((select private.is_lms_admin()))
  with check ((select private.is_lms_admin()));

create policy "lms_progress_own_all" on public.lms_lesson_progress
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "lms_progress_admin_read" on public.lms_lesson_progress
  for select to authenticated using ((select private.is_lms_admin()));

create policy "lms_announcements_enrolled_read" on public.lms_announcements
  for select to authenticated using (
    is_published and (
      course_id is null or exists (
        select 1 from public.lms_enrollments e
        where e.course_id = lms_announcements.course_id
          and e.user_id = (select auth.uid())
          and e.status = 'approved'
          and (e.expires_at is null or e.expires_at > now())
      )
    )
  );
create policy "lms_announcements_admin_all" on public.lms_announcements
  for all to authenticated using ((select private.is_lms_admin()))
  with check ((select private.is_lms_admin()));

create policy "lms_audit_admin_read" on public.lms_audit_logs
  for select to authenticated using ((select private.is_lms_admin()));
create policy "lms_audit_admin_insert" on public.lms_audit_logs
  for insert to authenticated with check ((select private.is_lms_admin()) and admin_id = (select auth.uid()));

grant select on public.lms_courses to anon;
grant select on public.lms_courses to authenticated;
grant select, insert, update, delete on public.lms_admin_invites to authenticated;
grant select on public.lms_profiles to authenticated;
grant update (full_name, phone, updated_at) on public.lms_profiles to authenticated;
grant select, insert, update, delete on public.lms_courses to authenticated;
grant select, insert, update, delete on public.lms_enrollments to authenticated;
grant select, insert, update, delete on public.lms_lessons to authenticated;
grant select, insert, update, delete on public.lms_payments to authenticated;
grant select, insert, update, delete on public.lms_lesson_progress to authenticated;
grant select, insert, update, delete on public.lms_announcements to authenticated;
grant select, insert on public.lms_audit_logs to authenticated;
grant usage, select on sequence public.lms_audit_logs_id_seq to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('lms-payment-slips', 'lms-payment-slips', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('lms-lesson-files', 'lms-lesson-files', false, 52428800, array['application/pdf','image/jpeg','image/png','video/mp4'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "lms_slips_insert_own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'lms-payment-slips' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "lms_slips_select_own_or_admin" on storage.objects
  for select to authenticated using (
    bucket_id = 'lms-payment-slips' and (
      owner_id = (select auth.uid())::text or (select private.is_lms_admin())
    )
  );
create policy "lms_slips_update_own_or_admin" on storage.objects
  for update to authenticated using (
    bucket_id = 'lms-payment-slips' and (owner_id = (select auth.uid())::text or (select private.is_lms_admin()))
  ) with check (
    bucket_id = 'lms-payment-slips' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_lms_admin()))
  );
create policy "lms_slips_delete_own_or_admin" on storage.objects
  for delete to authenticated using (
    bucket_id = 'lms-payment-slips' and (owner_id = (select auth.uid())::text or (select private.is_lms_admin()))
  );

create policy "lms_files_admin_all" on storage.objects
  for all to authenticated using (bucket_id = 'lms-lesson-files' and (select private.is_lms_admin()))
  with check (bucket_id = 'lms-lesson-files' and (select private.is_lms_admin()));
create policy "lms_files_enrolled_read" on storage.objects
  for select to authenticated using (
    bucket_id = 'lms-lesson-files' and exists (
      select 1 from public.lms_enrollments e
      where e.course_id::text = (storage.foldername(name))[1]
        and e.user_id = (select auth.uid())
        and e.status = 'approved'
        and (e.expires_at is null or e.expires_at > now())
    )
  );

-- Add administrator invitations from the Supabase dashboard after deployment.
-- Keeping real administrator identities out of source control prevents metadata leakage.

insert into public.lms_courses (code, title, grade, description, cover_color)
values
  ('MATH-G06', 'Grade 06 Mathematics', 'Grade 06', 'Core number skills, shapes and clear problem-solving for a confident start.', 'sage'),
  ('MATH-G07', 'Grade 07 Mathematics', 'Grade 07', 'Fractions, measurement and stronger mathematical thinking through guided practice.', 'lavender'),
  ('MATH-G08', 'Grade 08 Mathematics', 'Grade 08', 'Ratios, algebra basics and the key connections needed for advanced maths.', 'peach'),
  ('MATH-G09', 'Grade 09 Mathematics', 'Grade 09', 'Build a strong foundation with clear concepts and guided practice.', 'peach'),
  ('MATH-G10', 'Grade 10 Mathematics', 'Grade 10', 'Connect concepts through equations, geometry and practical problem solving.', 'sage'),
  ('MATH-G11', 'Grade 11 Mathematics', 'Grade 11', 'Focused O/L revision, past papers and exam practice.', 'lavender')
on conflict (code) do update set
  title = excluded.title,
  grade = excluded.grade,
  description = excluded.description,
  cover_color = excluded.cover_color;

insert into public.lms_lessons (course_id, title, description, lesson_type, duration_minutes, sort_order, is_published)
select id, 'Welcome & Course Guide', 'How to use your learning space and prepare for class.', 'recorded', 8, 1, true
from public.lms_courses
on conflict do nothing;

