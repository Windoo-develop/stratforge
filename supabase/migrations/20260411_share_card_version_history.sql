create table if not exists public.strat_versions (
  id uuid primary key default gen_random_uuid(),
  strat_id uuid references public.strats(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  snapshot jsonb not null,
  created_at timestamptz default now()
);

create index if not exists strat_versions_strat_id_idx on public.strat_versions(strat_id);
create index if not exists strat_versions_team_id_idx on public.strat_versions(team_id);
create index if not exists strat_versions_created_at_idx on public.strat_versions(created_at desc);

alter table public.strat_versions enable row level security;

drop policy if exists "strat_versions_select_team_members" on public.strat_versions;
create policy "strat_versions_select_team_members" on public.strat_versions for select to authenticated using (
  public.is_team_member(team_id)
);

drop policy if exists "strat_versions_insert_strat_editors" on public.strat_versions;
create policy "strat_versions_insert_strat_editors" on public.strat_versions for insert to authenticated with check (
  created_by = auth.uid()
  and public.can_edit_strat(strat_id)
  and public.is_team_member(team_id)
);
