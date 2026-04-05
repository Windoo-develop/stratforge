create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_username text;
begin
  next_username := public.generate_unique_username(
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'player')
  );

  begin
    insert into public.profiles (id, username, user_code, avatar_url, bio, team_id)
    values (
      new.id,
      next_username,
      public.generate_unique_user_code(),
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      left(nullif(new.raw_user_meta_data ->> 'bio', ''), 200),
      null
    )
    on conflict (id) do nothing;
  exception
    when undefined_column then
      begin
        insert into public.profiles (id, username, user_code, avatar_url)
        values (
          new.id,
          next_username,
          public.generate_unique_user_code(),
          nullif(new.raw_user_meta_data ->> 'avatar_url', '')
        )
        on conflict (id) do nothing;
      exception
        when others then
          raise warning 'handle_new_user fallback failed for user %: %', new.id, sqlerrm;
      end;
    when others then
      raise warning 'handle_new_user failed for user %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
