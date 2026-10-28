create extension if not exists vector with schema extensions;

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  feed_url text not null unique,
  site_url text,
  kind text not null check (kind in ('rss', 'youtube')),
  language text not null check (language in ('fi', 'en')),
  is_active boolean not null default false,
  etag text,
  last_modified text,
  last_fetched_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id),
  type text not null check (type in ('article', 'video')),
  url text not null unique,
  title text not null,
  summary text,
  language text not null check (language in ('fi', 'en')),
  categories text[] not null default array[]::text[],
  thumbnail_url text,
  published_at timestamptz not null,
  embedding extensions.vector(512),
  embedding_model text,
  created_at timestamptz not null default now()
);

create index content_items_published_at_idx
  on public.content_items (published_at desc);

alter table public.sources enable row level security;
alter table public.content_items enable row level security;

revoke all on table public.sources, public.content_items from anon, authenticated;
grant select on table public.sources, public.content_items to authenticated;
grant all on table public.sources, public.content_items to service_role;

create policy "Authenticated users can read sources"
  on public.sources
  for select
  to authenticated
  using (true);

create policy "Authenticated users can read content items"
  on public.content_items
  for select
  to authenticated
  using (true);