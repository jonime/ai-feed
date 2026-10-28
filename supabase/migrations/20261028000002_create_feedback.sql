create table public.feedback (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.content_items (id) on delete restrict,
  kind text not null check (kind in ('like', 'not_interested', 'seen')),
  via text not null check (via in ('button', 'swipe')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create function public.update_feedback_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.update_feedback_updated_at() from public, anon, authenticated;

create trigger feedback_updated_at
  before update on public.feedback
  for each row execute function public.update_feedback_updated_at();

alter table public.feedback enable row level security;

revoke all on table public.feedback from anon, authenticated;
grant select, insert, delete on table public.feedback to authenticated;
grant update (kind, via) on table public.feedback to authenticated;
grant all on table public.feedback to service_role;

create policy "Users can read their own feedback"
  on public.feedback
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own feedback"
  on public.feedback
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own feedback"
  on public.feedback
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own feedback"
  on public.feedback
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create function public.set_feedback(p_item_id uuid, p_kind text, p_via text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  insert into public.feedback (user_id, item_id, kind, via)
  values ((select auth.uid()), p_item_id, p_kind, p_via)
  on conflict (user_id, item_id) do update
    set kind = excluded.kind, via = excluded.via;
end;
$$;

revoke all on function public.set_feedback(uuid, text, text) from public, anon;
grant execute on function public.set_feedback(uuid, text, text) to authenticated;