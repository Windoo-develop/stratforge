alter table public.profiles
  add column if not exists advanced_access_enabled boolean not null default false;

create unique index if not exists advanced_registration_requests_one_pending_per_user_idx
  on public.advanced_registration_requests(user_id)
  where status = 'pending';

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

  update public.advanced_registration_requests
  set
    status = p_status,
    admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
    reviewed_at = now(),
    reviewed_by = auth.uid()
  where id = p_request_id;

  if v_request.user_id is not null then
    update public.profiles
    set advanced_access_enabled = (p_status = 'approved')
    where id = v_request.user_id;
  end if;
end;
$$;

insert into storage.buckets (id, name, public)
values ('advanced-registration-screenshots', 'advanced-registration-screenshots', true)
on conflict (id) do nothing;

drop policy if exists "advanced registration screenshots public read" on storage.objects;
create policy "advanced registration screenshots public read" on storage.objects for select using (
  bucket_id = 'advanced-registration-screenshots'
);

drop policy if exists "advanced registration screenshots auth upload" on storage.objects;
create policy "advanced registration screenshots auth upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'advanced-registration-screenshots'
  and split_part(name, '/', 2) = auth.uid()::text
);

drop policy if exists "advanced registration screenshots auth update" on storage.objects;
create policy "advanced registration screenshots auth update" on storage.objects for update to authenticated using (
  bucket_id = 'advanced-registration-screenshots'
  and split_part(name, '/', 2) = auth.uid()::text
) with check (
  bucket_id = 'advanced-registration-screenshots'
  and split_part(name, '/', 2) = auth.uid()::text
);

drop policy if exists "advanced_registration_requests_select_self" on public.advanced_registration_requests;
create policy "advanced_registration_requests_select_self" on public.advanced_registration_requests for select to authenticated using (
  user_id = auth.uid()
);
