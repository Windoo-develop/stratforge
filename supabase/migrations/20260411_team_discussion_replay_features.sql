alter table public.strats
  add column if not exists replay_steps jsonb not null default '[]'::jsonb;

create table if not exists public.lineup_comments (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid references public.lineups(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists public.strat_comments (
  id uuid primary key default gen_random_uuid(),
  strat_id uuid references public.strats(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists public.strat_lineups (
  strat_id uuid references public.strats(id) on delete cascade,
  lineup_id uuid references public.lineups(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  primary key (strat_id, lineup_id)
);

create index if not exists lineup_comments_lineup_id_idx on public.lineup_comments(lineup_id);
create index if not exists lineup_comments_team_id_idx on public.lineup_comments(team_id);
create index if not exists strat_comments_strat_id_idx on public.strat_comments(strat_id);
create index if not exists strat_comments_team_id_idx on public.strat_comments(team_id);
create index if not exists strat_lineups_strat_id_idx on public.strat_lineups(strat_id);
create index if not exists strat_lineups_lineup_id_idx on public.strat_lineups(lineup_id);

alter table public.lineup_comments enable row level security;
alter table public.strat_comments enable row level security;
alter table public.strat_lineups enable row level security;

create or replace function public.can_edit_strat(target_strat_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.strats s
    where s.id = target_strat_id
      and (
        public.is_team_creator(s.team_id)
        or (
          s.author_id = auth.uid()
          and exists (
            select 1
            from public.team_members tm
            where tm.team_id = s.team_id
              and tm.user_id = auth.uid()
              and tm.can_add_strats = true
          )
        )
      )
  );
$$;

drop policy if exists "lineup_comments_select_team_members" on public.lineup_comments;
create policy "lineup_comments_select_team_members" on public.lineup_comments for select to authenticated using (
  public.is_team_member(team_id)
);

drop policy if exists "lineup_comments_insert_team_members" on public.lineup_comments;
create policy "lineup_comments_insert_team_members" on public.lineup_comments for insert to authenticated with check (
  author_id = auth.uid()
  and public.is_team_member(team_id)
  and char_length(trim(body)) > 0
);

drop policy if exists "lineup_comments_update_author_or_creator" on public.lineup_comments;
create policy "lineup_comments_update_author_or_creator" on public.lineup_comments for update to authenticated using (
  author_id = auth.uid()
  or public.is_team_creator(team_id)
) with check (
  author_id = auth.uid()
  or public.is_team_creator(team_id)
);

drop policy if exists "lineup_comments_delete_author_or_creator" on public.lineup_comments;
create policy "lineup_comments_delete_author_or_creator" on public.lineup_comments for delete to authenticated using (
  author_id = auth.uid()
  or public.is_team_creator(team_id)
);

drop policy if exists "strat_comments_select_team_members" on public.strat_comments;
create policy "strat_comments_select_team_members" on public.strat_comments for select to authenticated using (
  public.is_team_member(team_id)
);

drop policy if exists "strat_comments_insert_team_members" on public.strat_comments;
create policy "strat_comments_insert_team_members" on public.strat_comments for insert to authenticated with check (
  author_id = auth.uid()
  and public.is_team_member(team_id)
  and char_length(trim(body)) > 0
);

drop policy if exists "strat_comments_update_author_or_creator" on public.strat_comments;
create policy "strat_comments_update_author_or_creator" on public.strat_comments for update to authenticated using (
  author_id = auth.uid()
  or public.is_team_creator(team_id)
) with check (
  author_id = auth.uid()
  or public.is_team_creator(team_id)
);

drop policy if exists "strat_comments_delete_author_or_creator" on public.strat_comments;
create policy "strat_comments_delete_author_or_creator" on public.strat_comments for delete to authenticated using (
  author_id = auth.uid()
  or public.is_team_creator(team_id)
);

drop policy if exists "strat_lineups_select_team_members" on public.strat_lineups;
create policy "strat_lineups_select_team_members" on public.strat_lineups for select to authenticated using (
  exists (
    select 1
    from public.strats s
    where s.id = strat_lineups.strat_id
      and public.is_team_member(s.team_id)
  )
);

drop policy if exists "strat_lineups_insert_strat_editors" on public.strat_lineups;
create policy "strat_lineups_insert_strat_editors" on public.strat_lineups for insert to authenticated with check (
  public.can_edit_strat(strat_id)
);

drop policy if exists "strat_lineups_update_strat_editors" on public.strat_lineups;
create policy "strat_lineups_update_strat_editors" on public.strat_lineups for update to authenticated using (
  public.can_edit_strat(strat_id)
) with check (
  public.can_edit_strat(strat_id)
);

drop policy if exists "strat_lineups_delete_strat_editors" on public.strat_lineups;
create policy "strat_lineups_delete_strat_editors" on public.strat_lineups for delete to authenticated using (
  public.can_edit_strat(strat_id)
);
