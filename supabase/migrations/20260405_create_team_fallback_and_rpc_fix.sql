create or replace function public.create_team(p_avatar_url text, p_name text, p_password text)
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

drop policy if exists "teams_insert_creator" on public.teams;
create policy "teams_insert_creator" on public.teams
for insert to authenticated
with check (creator_id = auth.uid());

drop policy if exists "team_members_insert_self_for_created_team" on public.team_members;
create policy "team_members_insert_self_for_created_team" on public.team_members
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.teams t
    where t.id = team_members.team_id
      and t.creator_id = auth.uid()
  )
);
