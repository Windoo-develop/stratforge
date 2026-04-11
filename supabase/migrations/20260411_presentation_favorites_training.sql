alter table public.strats
  add column if not exists training_checklist jsonb not null default '[]'::jsonb;

create table if not exists public.lineup_favorites (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid references public.lineups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (lineup_id, user_id)
);

create index if not exists lineup_favorites_lineup_id_idx on public.lineup_favorites(lineup_id);
create index if not exists lineup_favorites_user_id_idx on public.lineup_favorites(user_id);

alter table public.lineup_favorites enable row level security;

drop policy if exists "lineup_favorites_select_own" on public.lineup_favorites;
create policy "lineup_favorites_select_own" on public.lineup_favorites for select to authenticated using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.lineups l
    where l.id = lineup_favorites.lineup_id
      and public.is_team_member(l.team_id)
  )
);

drop policy if exists "lineup_favorites_insert_own" on public.lineup_favorites;
create policy "lineup_favorites_insert_own" on public.lineup_favorites for insert to authenticated with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.lineups l
    where l.id = lineup_favorites.lineup_id
      and public.is_team_member(l.team_id)
  )
);

drop policy if exists "lineup_favorites_delete_own" on public.lineup_favorites;
create policy "lineup_favorites_delete_own" on public.lineup_favorites for delete to authenticated using (
  user_id = auth.uid()
);
