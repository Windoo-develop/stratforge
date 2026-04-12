alter table public.profiles
  add column if not exists standoff_player_id text;

update public.profiles p
set standoff_player_id = source.player_id
from (
  select distinct on (user_id)
    user_id,
    nullif(trim(payload ->> 'standoff_player_id'), '') as player_id
  from public.advanced_registration_requests
  where status = 'approved'
    and user_id is not null
    and nullif(trim(payload ->> 'standoff_player_id'), '') is not null
  order by user_id, reviewed_at desc nulls last, created_at desc
) as source
where p.id = source.user_id
  and nullif(trim(coalesce(p.standoff_player_id, '')), '') is null;

create unique index if not exists profiles_standoff_player_id_unique_idx
  on public.profiles (lower(trim(standoff_player_id)))
  where nullif(trim(standoff_player_id), '') is not null;

create or replace function public.has_advanced_access()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.advanced_access_enabled = true
      and nullif(trim(p.standoff_player_id), '') is not null
  );
$$;

create or replace function public.is_standoff_player_id_available(
  p_player_id text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  with normalized as (
    select nullif(lower(trim(p_player_id)), '') as player_id
  )
  select case
    when (select player_id from normalized) is null then false
    else not exists (
      select 1
      from public.profiles p, normalized n
      where lower(trim(coalesce(p.standoff_player_id, ''))) = n.player_id
        and p.id <> coalesce(p_user_id, auth.uid())
    ) and not exists (
      select 1
      from public.advanced_registration_requests r, normalized n
      where lower(trim(coalesce(r.payload ->> 'standoff_player_id', ''))) = n.player_id
        and r.status in ('pending', 'approved')
        and coalesce(r.user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> coalesce(p_user_id, auth.uid())
    )
  end;
$$;

create or replace function public.review_advanced_registration_request(
  p_request_id uuid,
  p_status text,
  p_admin_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.advanced_registration_requests%rowtype;
  v_player_id text;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Invalid status';
  end if;

  select *
  into v_request
  from public.advanced_registration_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Advanced registration request not found';
  end if;

  v_player_id := nullif(trim(v_request.payload ->> 'standoff_player_id'), '');

  update public.advanced_registration_requests
  set
    status = p_status,
    admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
    reviewed_at = now(),
    reviewed_by = auth.uid()
  where id = p_request_id;

  if v_request.user_id is not null then
    update public.profiles
    set
      advanced_access_enabled = (p_status = 'approved'),
      standoff_player_id = case
        when p_status = 'approved' then v_player_id
        else null
      end
    where id = v_request.user_id;
  end if;
end;
$$;

create table if not exists public.dm_lobbies (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  map_id text not null,
  mode text not null check (mode in ('dm', 'pistol-dm', 'rifles-dm', 'awp-dm', 'force-dm')),
  headshots_only boolean not null default false,
  lobby_link text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '20 minutes')
);

create index if not exists dm_lobbies_expires_at_idx on public.dm_lobbies(expires_at desc);
create index if not exists dm_lobbies_created_at_idx on public.dm_lobbies(created_at desc);

alter table public.dm_lobbies enable row level security;

drop policy if exists "dm_lobbies_select_advanced" on public.dm_lobbies;
create policy "dm_lobbies_select_advanced" on public.dm_lobbies for select to authenticated using (
  public.has_advanced_access()
);

drop policy if exists "advanced_registration_requests_insert_self" on public.advanced_registration_requests;
create policy "advanced_registration_requests_insert_self" on public.advanced_registration_requests for insert to authenticated with check (
  coalesce(user_id, auth.uid()) = auth.uid()
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', email))
  and public.is_standoff_player_id_available(payload ->> 'standoff_player_id', auth.uid())
);

drop policy if exists "dm_lobbies_insert_advanced" on public.dm_lobbies;
create policy "dm_lobbies_insert_advanced" on public.dm_lobbies for insert to authenticated with check (
  creator_id = auth.uid()
  and public.has_advanced_access()
  and char_length(trim(lobby_link)) > 0
  and expires_at > now()
);

drop policy if exists "dm_lobbies_delete_creator" on public.dm_lobbies;
create policy "dm_lobbies_delete_creator" on public.dm_lobbies for delete to authenticated using (
  creator_id = auth.uid()
);
