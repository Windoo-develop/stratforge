create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid references auth.users primary key,
  username text not null,
  user_code text unique not null,
  avatar_url text,
  created_at timestamptz default now()
);

create or replace function public.generate_unique_user_code()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '/+=', 'XYZ'), 1, 8));
    exit when not exists (select 1 from public.profiles where user_code = candidate);
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
  next_username := coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'player');

  insert into public.profiles (id, username, user_code, avatar_url)
  values (
    new.id,
    next_username,
    public.generate_unique_user_code(),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  avatar_url text,
  password_hash text not null,
  creator_id uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'Player',
  can_add_lineups boolean default false,
  can_add_strats boolean default false,
  joined_at timestamptz default now(),
  unique(team_id, user_id)
);

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  invitee_user_code text not null,
  status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.lineups (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  author_id uuid references public.profiles(id),
  map text not null,
  name text not null,
  description text,
  video_url text,
  side text not null check (side in ('T', 'CT')),
  throw_stance text not null,
  throw_movement text not null,
  throw_jump boolean not null default false,
  grenade_type text not null check (grenade_type in ('smoke', 'flash', 'grenade', 'molotov')),
  screenshots text[] not null,
  created_at timestamptz default now()
);

create table if not exists public.strats (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  author_id uuid references public.profiles(id),
  map text not null,
  name text not null,
  types text[] not null,
  side text not null check (side in ('T', 'CT')),
  note text,
  video_url text,
  created_at timestamptz default now()
);

create or replace function public.create_team(p_name text, p_avatar_url text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.teams (name, avatar_url, password_hash, creator_id)
  values (p_name, p_avatar_url, crypt(p_password, gen_salt('bf')), auth.uid())
  returning id into v_team_id;

  insert into public.team_members (team_id, user_id, role, can_add_lineups, can_add_strats)
  values (v_team_id, auth.uid(), 'Creator', true, true);

  return v_team_id;
end;
$$;

create or replace function public.join_team_with_password(p_name text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_team from public.teams where lower(name) = lower(p_name);
  if v_team is null then
    raise exception 'Team not found';
  end if;

  if v_team.password_hash <> crypt(p_password, v_team.password_hash) then
    raise exception 'Incorrect team password';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (v_team.id, auth.uid(), 'Player')
  on conflict (team_id, user_id) do nothing;

  return v_team.id;
end;
$$;

create or replace function public.accept_team_invite(p_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.team_invites;
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  select * into v_invite from public.team_invites where id = p_invite_id and status = 'pending';

  if v_invite is null then
    raise exception 'Invite not found';
  end if;

  if v_invite.invitee_user_code <> v_profile.user_code then
    raise exception 'Invite does not belong to this user';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (v_invite.team_id, auth.uid(), 'Player')
  on conflict (team_id, user_id) do nothing;

  update public.team_invites set status = 'accepted' where id = p_invite_id;
  return v_invite.team_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.lineups enable row level security;
alter table public.strats enable row level security;

create or replace function public.is_team_member(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = target_team_id
      and tm.user_id = auth.uid()
  );
$$;

create or replace function public.is_team_creator(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.teams t
    where t.id = target_team_id
      and t.creator_id = auth.uid()
  );
$$;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles for select to authenticated using (true);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "teams_select_members" on public.teams;
create policy "teams_select_members" on public.teams for select to authenticated using (
  creator_id = auth.uid()
  or public.is_team_member(id)
);

drop policy if exists "teams_update_creator" on public.teams;
create policy "teams_update_creator" on public.teams for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());

drop policy if exists "teams_delete_creator" on public.teams;
create policy "teams_delete_creator" on public.teams for delete to authenticated using (creator_id = auth.uid());

drop policy if exists "team_members_select_team" on public.team_members;
create policy "team_members_select_team" on public.team_members for select to authenticated using (
  user_id = auth.uid()
  or public.is_team_creator(team_id)
  or public.is_team_member(team_id)
);

drop policy if exists "team_members_update_creator" on public.team_members;
create policy "team_members_update_creator" on public.team_members for update to authenticated using (
  public.is_team_creator(team_id)
) with check (
  public.is_team_creator(team_id)
);

drop policy if exists "team_members_delete_creator_or_self" on public.team_members;
create policy "team_members_delete_creator_or_self" on public.team_members for delete to authenticated using (
  (user_id = auth.uid() and not public.is_team_creator(team_id))
  or (public.is_team_creator(team_id) and team_members.user_id <> auth.uid())
);

drop policy if exists "team_invites_select_creator_or_invitee" on public.team_invites;
create policy "team_invites_select_creator_or_invitee" on public.team_invites for select to authenticated using (
  public.is_team_creator(team_id)
  or invitee_user_code = (select p.user_code from public.profiles p where p.id = auth.uid())
);

drop policy if exists "team_invites_insert_creator" on public.team_invites;
create policy "team_invites_insert_creator" on public.team_invites for insert to authenticated with check (
  public.is_team_creator(team_id)
);

drop policy if exists "team_invites_update_creator_or_invitee" on public.team_invites;
create policy "team_invites_update_creator_or_invitee" on public.team_invites for update to authenticated using (
  public.is_team_creator(team_id)
  or invitee_user_code = (select p.user_code from public.profiles p where p.id = auth.uid())
) with check (true);

drop policy if exists "lineups_select_team_members" on public.lineups;
create policy "lineups_select_team_members" on public.lineups for select to authenticated using (
  public.is_team_member(team_id)
);

drop policy if exists "lineups_insert_contributors" on public.lineups;
create policy "lineups_insert_contributors" on public.lineups for insert to authenticated with check (
  author_id = auth.uid()
  and (
    public.is_team_creator(team_id)
    or exists (select 1 from public.team_members tm where tm.team_id = lineups.team_id and tm.user_id = auth.uid() and tm.can_add_lineups = true)
  )
);

drop policy if exists "lineups_update_creator_or_author" on public.lineups;
create policy "lineups_update_creator_or_author" on public.lineups for update to authenticated using (
  public.is_team_creator(team_id)
  or (author_id = auth.uid() and exists (select 1 from public.team_members tm where tm.team_id = lineups.team_id and tm.user_id = auth.uid() and tm.can_add_lineups = true))
) with check (
  public.is_team_creator(team_id)
  or (author_id = auth.uid() and exists (select 1 from public.team_members tm where tm.team_id = lineups.team_id and tm.user_id = auth.uid() and tm.can_add_lineups = true))
);

drop policy if exists "lineups_delete_creator_only" on public.lineups;
create policy "lineups_delete_creator_only" on public.lineups for delete to authenticated using (
  public.is_team_creator(team_id)
);

drop policy if exists "strats_select_team_members" on public.strats;
create policy "strats_select_team_members" on public.strats for select to authenticated using (
  public.is_team_member(team_id)
);

drop policy if exists "strats_insert_contributors" on public.strats;
create policy "strats_insert_contributors" on public.strats for insert to authenticated with check (
  author_id = auth.uid()
  and (
    public.is_team_creator(team_id)
    or exists (select 1 from public.team_members tm where tm.team_id = strats.team_id and tm.user_id = auth.uid() and tm.can_add_strats = true)
  )
);

drop policy if exists "strats_update_creator_or_author" on public.strats;
create policy "strats_update_creator_or_author" on public.strats for update to authenticated using (
  public.is_team_creator(team_id)
  or (author_id = auth.uid() and exists (select 1 from public.team_members tm where tm.team_id = strats.team_id and tm.user_id = auth.uid() and tm.can_add_strats = true))
) with check (
  public.is_team_creator(team_id)
  or (author_id = auth.uid() and exists (select 1 from public.team_members tm where tm.team_id = strats.team_id and tm.user_id = auth.uid() and tm.can_add_strats = true))
);

drop policy if exists "strats_delete_creator_only" on public.strats;
create policy "strats_delete_creator_only" on public.strats for delete to authenticated using (
  public.is_team_creator(team_id)
);

insert into storage.buckets (id, name, public) values ('team-avatars', 'team-avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('lineup-screenshots', 'lineup-screenshots', true) on conflict (id) do nothing;

drop policy if exists "team avatars public read" on storage.objects;
create policy "team avatars public read" on storage.objects for select using (bucket_id = 'team-avatars');

drop policy if exists "team avatars auth upload" on storage.objects;
create policy "team avatars auth upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'team-avatars' and split_part(name, '/', 2) = auth.uid()::text
);

drop policy if exists "team avatars auth update" on storage.objects;
create policy "team avatars auth update" on storage.objects for update to authenticated using (
  bucket_id = 'team-avatars' and split_part(name, '/', 2) = auth.uid()::text
) with check (
  bucket_id = 'team-avatars' and split_part(name, '/', 2) = auth.uid()::text
);

drop policy if exists "lineup screenshots public read" on storage.objects;
create policy "lineup screenshots public read" on storage.objects for select using (bucket_id = 'lineup-screenshots');

drop policy if exists "lineup screenshots auth upload" on storage.objects;
create policy "lineup screenshots auth upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'lineup-screenshots' and split_part(name, '/', 2) = auth.uid()::text
);

drop policy if exists "lineup screenshots auth update" on storage.objects;
create policy "lineup screenshots auth update" on storage.objects for update to authenticated using (
  bucket_id = 'lineup-screenshots' and split_part(name, '/', 2) = auth.uid()::text
) with check (
  bucket_id = 'lineup-screenshots' and split_part(name, '/', 2) = auth.uid()::text
);
