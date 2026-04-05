drop policy if exists "teams_delete_creator" on public.teams;
create policy "teams_delete_creator" on public.teams
for delete to authenticated
using (creator_id = auth.uid());
