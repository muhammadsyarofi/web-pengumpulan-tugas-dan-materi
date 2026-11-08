-- =====================================================================
--  KelasHub — skema database Supabase
--  Jalankan SEKALI: lewat GitHub integration (folder supabase/migrations)
--  atau tempel seluruh isi file ini di Supabase > SQL Editor > Run.
-- =====================================================================

create schema if not exists private;

-- ---------------------------------------------------------------------
-- 1. TABEL
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  name        text not null check (char_length(name) between 1 and 80),
  nim         text,
  role        text not null default 'mahasiswa' check (role in ('dosen','mahasiswa')),
  created_at  timestamptz not null default now()
);

create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  descr       text not null default '',
  emoji       text not null default '🏫',
  color       text not null default '#6c5ce7',
  code        text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_at  timestamptz not null default now()
);

create table if not exists public.class_members (
  class_id    uuid not null references public.classes(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (class_id, user_id)
);

create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  code        text not null default '',
  emoji       text not null default '📘',
  color       text not null default '#6c5ce7',
  created_at  timestamptz not null default now()
);
create unique index if not exists courses_class_name_uq on public.courses (class_id, lower(name));

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes(id) on delete cascade,
  course_id    uuid not null references public.courses(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  descr        text not null default '',
  emoji        text not null default '📝',
  deadline     timestamptz not null,
  attach_path  text,
  attach_name  text,
  attach_size  bigint,
  by_id        uuid not null references public.profiles(id) on delete cascade,
  by_name      text not null default '',
  by_nid       text not null default '',
  created_at   timestamptz not null default now()
);

create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  class_id    uuid not null references public.classes(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  nim         text not null default '',
  note        text not null default '',
  file_path   text,
  file_name   text,
  file_size   bigint,
  late        boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (task_id, user_id)
);

create table if not exists public.materials (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes(id) on delete cascade,
  course_id    uuid not null references public.courses(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  cat          text not null default 'Modul' check (cat in ('Slide','Modul','Video','Catatan','Link')),
  descr        text not null default '',
  link         text check (link is null or link ~* '^https?://'),
  file_path    text,
  file_name    text,
  file_size    bigint,
  author_id    uuid not null references public.profiles(id) on delete cascade,
  author_name  text not null default '',
  created_at   timestamptz not null default now()
);

create table if not exists public.material_likes (
  material_id uuid not null references public.materials(id) on delete cascade,
  class_id    uuid not null references public.classes(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  primary key (material_id, user_id)
);

-- index untuk kolom yang dipakai RLS & query
create index if not exists class_members_user_idx  on public.class_members (user_id);
create index if not exists classes_owner_idx       on public.classes (owner_id);
create index if not exists courses_class_idx       on public.courses (class_id);
create index if not exists tasks_class_idx         on public.tasks (class_id);
create index if not exists tasks_course_idx        on public.tasks (course_id);
create index if not exists subs_task_idx           on public.submissions (task_id);
create index if not exists subs_class_idx          on public.submissions (class_id);
create index if not exists subs_user_idx           on public.submissions (user_id);
create index if not exists materials_class_idx     on public.materials (class_id);
create index if not exists materials_course_idx    on public.materials (course_id);
create index if not exists likes_class_idx         on public.material_likes (class_id);
create index if not exists likes_user_idx          on public.material_likes (user_id);

-- ---------------------------------------------------------------------
-- 2. FUNGSI BANTU (schema private: tidak bisa dipanggil lewat API)
-- ---------------------------------------------------------------------
create or replace function private.is_dosen() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'dosen');
$$;

create or replace function private.is_owner(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.classes where id = cid and owner_id = (select auth.uid()));
$$;

create or replace function private.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.class_members where class_id = cid and user_id = (select auth.uid()));
$$;

create or replace function private.shares_class(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_members a
    join public.class_members b on b.class_id = a.class_id
    where a.user_id = (select auth.uid()) and b.user_id = uid);
$$;

-- id kelas dari path file storage: "<class_id>/tasks|subs|mats/..."
create or replace function private.path_class(p text) returns uuid
language sql immutable set search_path = '' as $$
  select case when split_part(p, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p, '/', 1)::uuid end;
$$;

revoke all on function private.is_dosen(), private.is_owner(uuid), private.is_member(uuid),
                       private.shares_class(uuid), private.path_class(text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_dosen(), private.is_owner(uuid), private.is_member(uuid),
                          private.shares_class(uuid), private.path_class(text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. TRIGGER
-- ---------------------------------------------------------------------
-- a) akun baru -> buat profil. (metadata dibaca HANYA saat pendaftaran;
--    hak akses selalu dicek dari tabel profiles, bukan dari metadata.)
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, name, nim, role)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
    coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data->>'nim'), ''),
    case when new.raw_user_meta_data->>'role' = 'dosen' then 'dosen' else 'mahasiswa' end
  );
  return new;
end $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- b) pembuat kelas otomatis jadi anggota kelasnya
create or replace function private.add_owner_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.class_members (class_id, user_id) values (new.id, new.owner_id) on conflict do nothing;
  return new;
end $$;
revoke all on function private.add_owner_member() from public, anon, authenticated;

drop trigger if exists on_class_created on public.classes;
create trigger on_class_created after insert on public.classes
  for each row execute function private.add_owner_member();

-- c) status "terlambat" dihitung server, tidak bisa dipalsukan klien
create or replace function private.set_late() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.late := now() > (select deadline from public.tasks where id = new.task_id);
  new.created_at := now();
  return new;
end $$;

drop trigger if exists submissions_set_late on public.submissions;
create trigger submissions_set_late before insert or update on public.submissions
  for each row execute function private.set_late();

-- ---------------------------------------------------------------------
-- 4. GABUNG KELAS DENGAN KODE (mahasiswa tidak bisa melihat daftar kelas,
--    jadi pencarian kode dilakukan di dalam fungsi ini)
-- ---------------------------------------------------------------------
create or replace function public.join_class(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  c   public.classes;
begin
  if uid is null then raise exception 'Silakan masuk dulu'; end if;
  if not exists (select 1 from public.profiles where id = uid and role = 'mahasiswa') then
    raise exception 'Hanya akun mahasiswa yang bisa bergabung dengan kode kelas';
  end if;
  select * into c from public.classes where code = upper(trim(p_code));
  if not found then raise exception 'Kode kelas tidak ditemukan'; end if;
  insert into public.class_members (class_id, user_id) values (c.id, uid) on conflict do nothing;
  return jsonb_build_object('id', c.id, 'name', c.name);
end $$;
revoke all on function public.join_class(text) from public, anon;
grant execute on function public.join_class(text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.classes        enable row level security;
alter table public.class_members  enable row level security;
alter table public.courses        enable row level security;
alter table public.tasks          enable row level security;
alter table public.submissions    enable row level security;
alter table public.materials      enable row level security;
alter table public.material_likes enable row level security;

revoke all on public.profiles, public.classes, public.class_members, public.courses, public.tasks,
              public.submissions, public.materials, public.material_likes from anon;
grant select                         on public.profiles       to authenticated;
grant select, insert, update, delete on public.classes        to authenticated;
grant select, delete                 on public.class_members  to authenticated;
grant select, insert, update, delete on public.courses        to authenticated;
grant select, insert, update, delete on public.tasks          to authenticated;
grant select, insert, update, delete on public.submissions    to authenticated;
grant select, insert, delete         on public.materials      to authenticated;
grant select, insert, delete         on public.material_likes to authenticated;

-- profiles: lihat diri sendiri + orang sekelas
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_class(id));

-- classes: dosen membuat; hanya pembuat yang ubah/hapus; anggota boleh lihat
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select to authenticated
  using (owner_id = (select auth.uid()) or private.is_member(id));
drop policy if exists classes_insert on public.classes;
create policy classes_insert on public.classes for insert to authenticated
  with check (owner_id = (select auth.uid()) and private.is_dosen());
drop policy if exists classes_update on public.classes;
create policy classes_update on public.classes for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists classes_delete on public.classes;
create policy classes_delete on public.classes for delete to authenticated
  using (owner_id = (select auth.uid()));

-- class_members: anggota melihat teman sekelas; keluar kelas; dosen mengeluarkan mahasiswa
drop policy if exists members_select on public.class_members;
create policy members_select on public.class_members for select to authenticated
  using (private.is_member(class_id));
drop policy if exists members_delete on public.class_members;
create policy members_delete on public.class_members for delete to authenticated
  using ((user_id = (select auth.uid()) and not private.is_owner(class_id))
      or (private.is_owner(class_id) and user_id <> (select auth.uid())));

-- courses
drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses for select to authenticated
  using (private.is_member(class_id));
drop policy if exists courses_insert on public.courses;
create policy courses_insert on public.courses for insert to authenticated
  with check (private.is_owner(class_id));
drop policy if exists courses_update on public.courses;
create policy courses_update on public.courses for update to authenticated
  using (private.is_owner(class_id)) with check (private.is_owner(class_id));
drop policy if exists courses_delete on public.courses;
create policy courses_delete on public.courses for delete to authenticated
  using (private.is_owner(class_id));

-- tasks: dosen pemilik kelas mengirim tugas; anggota membaca
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (private.is_member(class_id));
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (private.is_owner(class_id) and by_id = (select auth.uid())
    and exists (select 1 from public.courses c where c.id = course_id and c.class_id = tasks.class_id));
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (private.is_owner(class_id)) with check (private.is_owner(class_id));
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated
  using (private.is_owner(class_id));

-- submissions: mahasiswa hanya melihat miliknya; dosen melihat semua di kelasnya
drop policy if exists subs_select on public.submissions;
create policy subs_select on public.submissions for select to authenticated
  using (user_id = (select auth.uid()) or private.is_owner(class_id));
drop policy if exists subs_insert on public.submissions;
create policy subs_insert on public.submissions for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_member(class_id) and not private.is_owner(class_id)
    and exists (select 1 from public.tasks t where t.id = task_id and t.class_id = submissions.class_id));
drop policy if exists subs_update on public.submissions;
create policy subs_update on public.submissions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.is_member(class_id)
    and exists (select 1 from public.tasks t where t.id = task_id and t.class_id = submissions.class_id));
drop policy if exists subs_delete on public.submissions;
create policy subs_delete on public.submissions for delete to authenticated
  using (user_id = (select auth.uid()) or private.is_owner(class_id));

-- materials: semua anggota boleh berbagi; hapus oleh pengunggah atau dosen
drop policy if exists mats_select on public.materials;
create policy mats_select on public.materials for select to authenticated
  using (private.is_member(class_id));
drop policy if exists mats_insert on public.materials;
create policy mats_insert on public.materials for insert to authenticated
  with check (private.is_member(class_id) and author_id = (select auth.uid())
    and exists (select 1 from public.courses c where c.id = course_id and c.class_id = materials.class_id));
drop policy if exists mats_delete on public.materials;
create policy mats_delete on public.materials for delete to authenticated
  using (author_id = (select auth.uid()) or private.is_owner(class_id));

-- material_likes
drop policy if exists likes_select on public.material_likes;
create policy likes_select on public.material_likes for select to authenticated
  using (private.is_member(class_id));
drop policy if exists likes_insert on public.material_likes;
create policy likes_insert on public.material_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_member(class_id)
    and exists (select 1 from public.materials m where m.id = material_id and m.class_id = material_likes.class_id));
drop policy if exists likes_delete on public.material_likes;
create policy likes_delete on public.material_likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 6. STORAGE: bucket privat "files" (maks 10 MB / file)
--    Struktur path: <class_id>/tasks/..  <class_id>/subs/<user_id>/..  <class_id>/mats/..
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists files_select on storage.objects;
create policy files_select on storage.objects for select to authenticated
  using (bucket_id = 'files' and private.is_member(private.path_class(name))
    and (split_part(name, '/', 2) <> 'subs'
         or private.is_owner(private.path_class(name))
         or split_part(name, '/', 3) = (select auth.uid())::text));

drop policy if exists files_insert on storage.objects;
create policy files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and private.is_member(private.path_class(name))
    and (   (split_part(name, '/', 2) = 'subs'  and split_part(name, '/', 3) = (select auth.uid())::text)
         or (split_part(name, '/', 2) = 'tasks' and private.is_owner(private.path_class(name)))
         or  split_part(name, '/', 2) = 'mats'));

drop policy if exists files_delete on storage.objects;
create policy files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'files' and (owner_id = (select auth.uid())::text
         or private.is_owner(private.path_class(name))));
