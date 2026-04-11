alter table public.team_members
  add column if not exists role_preset text check (role_preset in ('igl', 'entry', 'support', 'lurker', 'awp'));

alter table public.lineups
  add column if not exists anchor_ids text[] not null default '{}'::text[];

alter table public.strats
  add column if not exists anchor_ids text[] not null default '{}'::text[];
