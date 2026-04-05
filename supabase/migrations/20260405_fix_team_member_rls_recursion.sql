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

drop policy if exists "teams_select_members" on public.teams;
create policy "teams_select_members" on public.teams
for select to authenticated
using (
  creator_id = auth.uid()
  or public.is_team_member(id)
);

drop policy if exists "team_members_select_team" on public.team_members;
create policy "team_members_select_team" on public.team_members
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_team_creator(team_id)
  or public.is_team_member(team_id)
);

drop policy if exists "team_members_update_creator" on public.team_members;
create policy "team_members_update_creator" on public.team_members
for update to authenticated
using (public.is_team_creator(team_id))
with check (public.is_team_creator(team_id));

drop policy if exists "team_members_delete_creator_or_self" on public.team_members;
create policy "team_members_delete_creator_or_self" on public.team_members
for delete to authenticated
using (
  (user_id = auth.uid() and not public.is_team_creator(team_id))
  or (public.is_team_creator(team_id) and team_members.user_id <> auth.uid())
);

drop policy if exists "team_invites_select_creator_or_invitee" on public.team_invites;
create policy "team_invites_select_creator_or_invitee" on public.team_invites
for select to authenticated
using (
  public.is_team_creator(team_id)
  or invitee_user_code = (select p.user_code from public.profiles p where p.id = auth.uid())
);

drop policy if exists "team_invites_insert_creator" on public.team_invites;
create policy "team_invites_insert_creator" on public.team_invites
for insert to authenticated
with check (public.is_team_creator(team_id));

drop policy if exists "team_invites_update_creator_or_invitee" on public.team_invites;
create policy "team_invites_update_creator_or_invitee" on public.team_invites
for update to authenticated
using (
  public.is_team_creator(team_id)
  or invitee_user_code = (select p.user_code from public.profiles p where p.id = auth.uid())
)
with check (true);

drop policy if exists "lineups_select_team_members" on public.lineups;
create policy "lineups_select_team_members" on public.lineups
for select to authenticated
using (public.is_team_member(team_id));

drop policy if exists "lineups_insert_contributors" on public.lineups;
create policy "lineups_insert_contributors" on public.lineups
for insert to authenticated
with check (
  author_id = auth.uid()
  and (
    public.is_team_creator(team_id)
    or exists (
      select 1
      from public.team_members tm
      where tm.team_id = lineups.team_id
        and tm.user_id = auth.uid()
        and tm.can_add_lineups = true
    )
  )
);

drop policy if exists "lineups_update_creator_or_author" on public.lineups;
create policy "lineups_update_creator_or_author" on public.lineups
for update to authenticated
using (
  public.is_team_creator(team_id)
  or (
    author_id = auth.uid()
    and exists (
      select 1
      from public.team_members tm
      where tm.team_id = lineups.team_id
        and tm.user_id = auth.uid()
        and tm.can_add_lineups = true
    )
  )
)
with check (
  public.is_team_creator(team_id)
  or (
    author_id = auth.uid()
    and exists (
      select 1
      from public.team_members tm
      where tm.team_id = lineups.team_id
        and tm.user_id = auth.uid()
        and tm.can_add_lineups = true
    )
  )
);

drop policy if exists "lineups_delete_creator_only" on public.lineups;
create policy "lineups_delete_creator_only" on public.lineups
for delete to authenticated
using (public.is_team_creator(team_id));

drop policy if exists "strats_select_team_members" on public.strats;
create policy "strats_select_team_members" on public.strats
for select to authenticated
using (public.is_team_member(team_id));

drop policy if exists "strats_insert_contributors" on public.strats;
create policy "strats_insert_contributors" on public.strats
for insert to authenticated
with check (
  author_id = auth.uid()
  and (
    public.is_team_creator(team_id)
    or exists (
      select 1
      from public.team_members tm
      where tm.team_id = strats.team_id
        and tm.user_id = auth.uid()
        and tm.can_add_strats = true
    )
  )
);

drop policy if exists "strats_update_creator_or_author" on public.strats;
create policy "strats_update_creator_or_author" on public.strats
for update to authenticated
using (
  public.is_team_creator(team_id)
  or (
    author_id = auth.uid()
    and exists (
      select 1
      from public.team_members tm
      where tm.team_id = strats.team_id
        and tm.user_id = auth.uid()
        and tm.can_add_strats = true
    )
  )
)
with check (
  public.is_team_creator(team_id)
  or (
    author_id = auth.uid()
    and exists (
      select 1
      from public.team_members tm
      where tm.team_id = strats.team_id
        and tm.user_id = auth.uid()
        and tm.can_add_strats = true
    )
  )
);

drop policy if exists "strats_delete_creator_only" on public.strats;
create policy "strats_delete_creator_only" on public.strats
for delete to authenticated
using (public.is_team_creator(team_id));
