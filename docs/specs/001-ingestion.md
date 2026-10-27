# 001 — Project setup, content ingestion, and early checks

**Status:** Draft  
**Milestone:** Prototype (weeks 1–2)  
**Depends on:** —  
**Estimate:** 19 h

## Goal

Fetch the active feeds, normalize and deduplicate their items, embed them, and store them in Supabase, so that the feed and recommender have content to work with. Also verify early that the embedding model handles Finnish and English well and that nearest-liked ranking is promising (gate 1).

## Context

- Sources and normalization rules: [design.md §1](../design.md#1-content-sources-and-representation)
- Stack: [design.md §5](../design.md#5-technology-stack)
- Security rules: [design.md §5.1](../design.md#51-data-access-and-security)
- Tables: [design.md §6.1–6.2](../design.md#6-data-model)
- Feed catalog: [feeds.md](../feeds.md)

## In scope

- Project scaffold: Next.js (App Router, TypeScript), pnpm, Vitest, ESLint, Supabase CLI linked to the cloud project, `.env.example`, `.gitignore`.
- Migration: enable pgvector; create `sources` and `content_items` with RLS.
- Seed `sources` from feeds.md: the 17 initial feeds active, the rest inactive, Reddit excluded.
- Ingestion command `pnpm ingest`, run manually in the prototype.
- Cross-lingual embedding check script.
- Early ranking experiment script ([design.md §4.1](../design.md#41-early-checks-week-2-spec-001)).

## Out of scope

- Scheduling (GitHub Actions) — later spec, week 4.
- Pruning old items.
- Any UI.
- Fetching linked pages (e.g. meta descriptions for Hacker News).
- Video transcripts.

## Design notes

**Fetching**

- Conditional GET with stored `etag` / `last_modified`; 15 s timeout; 5 MB response limit; identifying User-Agent.
- Feeds are fetched with limited concurrency (e.g. 4).
- A failing source is recorded in `sources.last_error` and does not stop the run.

**Parsing and normalization**

- Supported formats: RSS 2.0, Atom, YouTube Atom (`media:group` / `media:description` / `media:thumbnail`).
- URL normalization: lowercase scheme and host; remove fragment; remove tracking parameters (`utm_*`, `origin`, `at_medium`, `at_campaign`, `fbclid`, `gclid`); keep all other parameters (YouTube `v` must survive).
- Text: strip HTML, decode entities, collapse whitespace; summary truncated to ~1,000 characters.
- Summary source: RSS `description` or Atom `summary`; never full `content` (The Verge includes full HTML with ads).
- Hacker News: the description only contains a "Comments" link, so the summary is empty.
- YouTube descriptions: drop lines containing URLs and known boilerplate (subscribe, social media, affiliate, sponsor lines), then truncate.
- `type` is `video` for YouTube sources, otherwise `article`.
- `published_at`: `pubDate` / `published` / `updated`; falls back to fetch time.
- Deduplication: insert on normalized `url`; on conflict do nothing (first source wins).

**Embedding**

- Input: `title + "\n\n" + summary` (title only if no summary).
- `text-embedding-3-small` with `dimensions: 512`; batches of up to 100 items; only rows where `embedding is null`.
- `embedding_model` is stored as `text-embedding-3-small@512`.
- Failed batches stay null and are retried on the next run.

**Secrets**

- `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` only in `.env.local` (gitignored); ingestion is a server-side script.

**Cross-lingual check**

- Pick ≥ 10 pairs of the same event from Yle News in English and Finnish Yle feeds, plus random pairs.
- Report cosine similarity for matched vs random pairs; the result is recorded in `docs/ai-log.md` and decides whether the embedding model is kept.

**Early ranking experiment (gate 1)**

- Fixed bilingual sample of ~300 embedded items, saved as a list of item IDs so the experiment is repeatable.
- Two personas, each with ~5 hand-picked liked item IDs (at least one Finnish) stored in a small config file.
- Rank the remaining sample with nearest-liked (λ = 0, no dislikes), average-vector, and newest-first.
- Output the merged, shuffled top 10s as a CSV for blind manual judging; a second step computes precision@10 per method from the judged CSV.
- No database writes; read-only queries with the service role in a local script.

## Acceptance criteria

1. `supabase db reset` applies all migrations cleanly; `sources` and `content_items` exist with RLS enabled.
2. RLS test: an authenticated user can `select` from both tables; an anonymous client cannot read them; an authenticated user cannot insert, update, or delete.
3. Unit tests for URL normalization cover: Yle `?origin=rss`, BBC `?at_medium=RSS&at_campaign=rss`, `utm_*`, fragments, and YouTube `watch?v=` (preserved).
4. Parser tests use saved fixtures from real feeds (Yle RSS, BBC RSS, The Verge Atom, Hacker News RSS, YouTube Atom) and check title, URL, summary, published date, categories, thumbnail, and type.
5. Unit test: YouTube boilerplate removal keeps the descriptive text and drops link/subscribe/affiliate lines.
6. Running `pnpm ingest` twice in a row creates no duplicate items; the second run reports 0 new items for unchanged feeds.
7. A failing feed (mocked 404 or timeout) is recorded in `sources.last_error` while other feeds are still ingested.
8. After a run, every new item has a 512-dimension embedding and `embedding_model` set.
9. `pnpm ingest` prints a per-source summary: fetched, new, skipped (not modified), errors.
10. The cross-lingual check reports a clearly higher average similarity for matched pairs than for random pairs.
11. The early ranking experiment produces a blind-judging CSV and, after judging, precision@10 for nearest-liked, average-vector, and newest-first per persona; the result and the gate 1 decision are recorded in `docs/ai-log.md`.
12. `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.

## Tasks

- [ ] 1. Scaffold Next.js + TypeScript with pnpm, Vitest, ESLint; add `.env.example` and `.gitignore`; confirm script names in AGENTS.md.
- [ ] 2. Initialize Supabase CLI and link the cloud project; migration enabling pgvector and creating `sources` and `content_items` with RLS.
- [ ] 3. Seed migration for `sources` from feeds.md.
- [ ] 4. Fetch module (conditional GET, timeout, size limit, concurrency).
- [ ] 5. Save feed fixtures; parse and normalize module with unit tests (criteria 3–5).
- [ ] 6. Database writes (insert on conflict do nothing, source status updates).
- [ ] 7. Embedding module (batching, retry on next run).
- [ ] 8. `pnpm ingest` command with per-source summary.
- [ ] 9. RLS tests (criterion 2).
- [ ] 10. Cross-lingual check script; record the result in `docs/ai-log.md`.
- [ ] 11. Early ranking experiment scripts (export for blind judging, score judged CSV); record the result and gate 1 decision.

## Open questions

- Should YouTube Shorts be kept? Proposal: keep them; they are short but on-topic.
- Should the cross-lingual check also compare a local multilingual embedding model? Proposal: only if the OpenAI model performs poorly.
