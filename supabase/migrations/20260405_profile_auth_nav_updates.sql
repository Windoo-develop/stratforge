alter table public.profiles
  add column if not exists bio text,
  add column if not exists team_id uuid references public.teams(id) on delete set null;

alter table public.profiles
  alter column user_code set default public.generate_unique_user_code();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_username_key'
  ) then
    alter table public.profiles add constraint profiles_username_key unique (username);
  end if;
end $$;

create or replace function public.normalize_username(p_value text)
returns text
language plpgsql
immutable
as $$
declare
  sanitized text;
begin
  sanitized := regexp_replace(coalesce(p_value, 'player'), '[^A-Za-z0-9_]', '_', 'g');
  sanitized := regexp_replace(sanitized, '_+', '_', 'g');
  sanitized := trim(both '_' from sanitized);
  sanitized := left(sanitized, 30);

  if char_length(sanitized) < 3 then
    sanitized := 'player';
  end if;

  return sanitized;
end;
$$;

create or replace function public.generate_unique_username(p_base text)
returns text
language plpgsql
as $$
declare
  base_value text;
  candidate text;
  suffix_length integer := 0;
begin
  base_value := public.normalize_username(p_base);
  candidate := base_value;

  loop
    exit when not exists (
      select 1 from public.profiles where username = candidate
    );

    suffix_length := suffix_length + 1;
    candidate := left(base_value, greatest(3, 30 - length(suffix_length::text) - 1)) || '_' || suffix_length::text;
  end loop;

  return candidate;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_username text;
begin
  next_username := public.generate_unique_username(
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'player')
  );

  insert into public.profiles (id, username, user_code, avatar_url, bio, team_id)
  values (
    new.id,
    next_username,
    public.generate_unique_user_code(),
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    left(nullif(new.raw_user_meta_data ->> 'bio', ''), 200),
    null
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.sync_profile_team_from_memberships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_team_id uuid;
begin
  if tg_op = 'INSERT' then
    update public.profiles
    set team_id = coalesce(team_id, new.team_id)
    where id = new.user_id;

    return new;
  end if;

  if tg_op = 'DELETE' then
    select tm.team_id
      into next_team_id
    from public.team_members tm
    where tm.user_id = old.user_id
    order by tm.joined_at asc
    limit 1;

    update public.profiles
    set team_id = case when team_id = old.team_id then next_team_id else team_id end
    where id = old.user_id;

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists sync_profile_team_after_member_insert on public.team_members;
create trigger sync_profile_team_after_member_insert
after insert on public.team_members
for each row execute procedure public.sync_profile_team_from_memberships();

drop trigger if exists sync_profile_team_after_member_delete on public.team_members;
create trigger sync_profile_team_after_member_delete
after delete on public.team_members
for each row execute procedure public.sync_profile_team_from_memberships();

update public.profiles p
set team_id = membership.team_id
from (
  select distinct on (tm.user_id) tm.user_id, tm.team_id
  from public.team_members tm
  order by tm.user_id, tm.joined_at asc
) membership
where p.id = membership.user_id
  and p.team_id is null;

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
for insert to authenticated
with check (auth.uid() = id);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
for select
using (bucket_id = 'avatars');

drop policy if exists "avatars auth upload" on storage.objects;
create policy "avatars auth upload" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 2) = auth.uid()::text
);

drop policy if exists "avatars auth update" on storage.objects;
create policy "avatars auth update" on storage.objects
for update to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 2) = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 2) = auth.uid()::text
);
