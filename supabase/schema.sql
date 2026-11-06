-- طموح: مخطط قاعدة البيانات + سياسات الصلاحيات (RLS) لـ Supabase.
-- الصقه كاملًا في SQL Editor ثم Run. لم يُختبر على مشروع حقيقي، راجعه قبل الاستخدام.
create extension if not exists pgcrypto;

create table public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student','admin')),
  display_name text, created_at timestamptz default now());

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public as
$$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as
$$ begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'name','')); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- بيانات الطالب كاملة (مزامنة): نسخة واحدة لكل طالب مع رقم نسخة لمعالجة التعارض
create table public.student_data(
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}', version int not null default 1, updated_at timestamptz default now());

-- المحتوى التعليمي (يديره المدير فقط، ولا يظهر للطلاب إلا بعد الاعتماد)
create table public.subjects(id uuid primary key default gen_random_uuid(), grade text not null, system text not null, track text default '', name text not null, status text not null default 'draft' check (status in ('draft','review','published')), source text);
create table public.units(id uuid primary key default gen_random_uuid(), subject_id uuid references public.subjects on delete cascade, title text not null, position int default 0);
create table public.lessons(id uuid primary key default gen_random_uuid(), unit_id uuid references public.units on delete cascade, title text not null, summary text, pdf_url text, position int default 0, status text not null default 'draft' check (status in ('draft','review','published')), source text);
create table public.questions(id uuid primary key default gen_random_uuid(), lesson_id uuid references public.lessons on delete set null, subject_id uuid references public.subjects on delete cascade, type text not null check (type in ('mcq','tf')), body text not null, choices jsonb, answer int not null, explanation text, source text, status text not null default 'draft' check (status in ('draft','review','published')));
create table public.announcements(id uuid primary key default gen_random_uuid(), title text not null, body text, active boolean default true, created_at timestamptz default now());

alter table public.profiles enable row level security;
alter table public.student_data enable row level security;
alter table public.subjects enable row level security;
alter table public.units enable row level security;
alter table public.lessons enable row level security;
alter table public.questions enable row level security;
alter table public.announcements enable row level security;

create policy p_sel on public.profiles for select using (id=auth.uid() or public.is_admin());
create policy p_upd on public.profiles for update using (id=auth.uid()) with check (id=auth.uid() and role=(select role from public.profiles where id=auth.uid()));
create policy p_adm on public.profiles for update using (public.is_admin());

create policy sd_all on public.student_data for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy sd_adm on public.student_data for select using (public.is_admin());

create policy sub_r on public.subjects for select using (status='published' or public.is_admin());
create policy sub_w on public.subjects for all using (public.is_admin()) with check (public.is_admin());
create policy un_r on public.units for select using (exists(select 1 from public.subjects s where s.id=subject_id and (s.status='published' or public.is_admin())));
create policy un_w on public.units for all using (public.is_admin()) with check (public.is_admin());
create policy le_r on public.lessons for select using (status='published' or public.is_admin());
create policy le_w on public.lessons for all using (public.is_admin()) with check (public.is_admin());
create policy qu_r on public.questions for select using (status='published' or public.is_admin());
create policy qu_w on public.questions for all using (public.is_admin()) with check (public.is_admin());
create policy an_r on public.announcements for select using (active or public.is_admin());
create policy an_w on public.announcements for all using (public.is_admin()) with check (public.is_admin());

-- لتعيين أول مدير (نفّذها مرة واحدة بعد تسجيل حسابك): 
-- update public.profiles set role='admin' where id=(select id from auth.users where email='بريدك@example.com');
