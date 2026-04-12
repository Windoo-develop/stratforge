create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = any (
    array[
      'aloe230409@gmail.com',
      'oasi050675@gmail.com'
    ]
  );
$$;

create table if not exists public.advanced_registration_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  payload jsonb not null default '{}'::jsonb,
  admin_notes text,
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'pending', 'closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.support_conversations(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete cascade,
  body text not null,
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists advanced_registration_requests_status_idx on public.advanced_registration_requests(status);
create index if not exists support_conversations_user_id_idx on public.support_conversations(user_id);
create index if not exists support_conversations_updated_at_idx on public.support_conversations(updated_at desc);
create index if not exists support_messages_conversation_id_idx on public.support_messages(conversation_id);
create index if not exists support_messages_created_at_idx on public.support_messages(created_at);

create or replace function public.touch_support_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_conversations
  set updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists support_messages_touch_conversation on public.support_messages;
create trigger support_messages_touch_conversation
after insert on public.support_messages
for each row
execute function public.touch_support_conversation();

alter table public.advanced_registration_requests enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "advanced_registration_requests_select_admin" on public.advanced_registration_requests;
create policy "advanced_registration_requests_select_admin" on public.advanced_registration_requests for select to authenticated using (
  public.is_platform_admin()
);

drop policy if exists "advanced_registration_requests_insert_self" on public.advanced_registration_requests;
create policy "advanced_registration_requests_insert_self" on public.advanced_registration_requests for insert to authenticated with check (
  coalesce(user_id, auth.uid()) = auth.uid()
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', email))
);

drop policy if exists "advanced_registration_requests_update_admin" on public.advanced_registration_requests;
create policy "advanced_registration_requests_update_admin" on public.advanced_registration_requests for update to authenticated using (
  public.is_platform_admin()
) with check (
  public.is_platform_admin()
);

drop policy if exists "support_conversations_select_owner_or_admin" on public.support_conversations;
create policy "support_conversations_select_owner_or_admin" on public.support_conversations for select to authenticated using (
  user_id = auth.uid()
  or public.is_platform_admin()
);

drop policy if exists "support_conversations_insert_owner" on public.support_conversations;
create policy "support_conversations_insert_owner" on public.support_conversations for insert to authenticated with check (
  user_id = auth.uid()
  and char_length(trim(subject)) > 0
);

drop policy if exists "support_conversations_update_admin" on public.support_conversations;
create policy "support_conversations_update_admin" on public.support_conversations for update to authenticated using (
  public.is_platform_admin()
) with check (
  public.is_platform_admin()
);

drop policy if exists "support_messages_select_owner_or_admin" on public.support_messages;
create policy "support_messages_select_owner_or_admin" on public.support_messages for select to authenticated using (
  exists (
    select 1
    from public.support_conversations c
    where c.id = support_messages.conversation_id
      and (
        c.user_id = auth.uid()
        or public.is_platform_admin()
      )
  )
);

drop policy if exists "support_messages_insert_owner" on public.support_messages;
create policy "support_messages_insert_owner" on public.support_messages for insert to authenticated with check (
  author_id = auth.uid()
  and is_admin = false
  and char_length(trim(body)) > 0
  and exists (
    select 1
    from public.support_conversations c
    where c.id = support_messages.conversation_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "support_messages_insert_admin" on public.support_messages;
create policy "support_messages_insert_admin" on public.support_messages for insert to authenticated with check (
  author_id = auth.uid()
  and is_admin = true
  and public.is_platform_admin()
  and char_length(trim(body)) > 0
  and exists (
    select 1
    from public.support_conversations c
    where c.id = support_messages.conversation_id
  )
);
