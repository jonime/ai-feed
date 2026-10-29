create table public.embedding_language_means (
  embedding_model text not null,
  language text not null check (language in ('fi', 'en')),
  mean extensions.vector(512) not null,
  item_count integer not null check (item_count >= 50),
  computed_at timestamptz not null default now(),
  primary key (embedding_model, language)
);

alter table public.embedding_language_means enable row level security;

revoke all on table public.embedding_language_means from public, anon, authenticated;
grant select on table public.embedding_language_means to authenticated;
grant all on table public.embedding_language_means to service_role;

create policy "Authenticated users can read language means"
  on public.embedding_language_means
  for select
  to authenticated
  using (true);