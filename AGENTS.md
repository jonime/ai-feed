# Agent Instructions

AI-powered personal content feed: ingests Finnish and English RSS/Atom/YouTube feeds, embeds items, and recommends links per user based on feedback. Solo course project (7 weeks, 135 h; final deadline 13 Dec 2026).

## Documents

- [docs/plan.md](docs/plan.md) — scope, deliverables, schedule, decisions
- [docs/design.md](docs/design.md) — architecture, recommender, security rules, data model
- [docs/specs/](docs/specs/) — feature specs; **read the relevant spec before implementing**
- [docs/ai-log.md](docs/ai-log.md) — log of significant AI-assisted work

## Workflow (spec-driven)

1. Work on one spec at a time, one task at a time, in the order of its task list.
2. Implement only what the spec asks for. If something is unclear or missing, stop and ask instead of guessing; propose spec changes explicitly.
3. Each task is done when its acceptance criteria pass and `lint`, `typecheck`, and `test` pass.
4. Tick off the task in the spec. The human reviews the diff and commits.
5. Significant AI-assisted steps get a short entry in `docs/ai-log.md`.

## Stack

- Next.js (App Router) + TypeScript, deployed on Vercel
- Supabase Postgres + pgvector; SQL migrations via Supabase CLI; supabase-js / `@supabase/ssr`; no ORM
- Supabase Auth (Google)
- OpenAI: `text-embedding-3-small` (512 dimensions); small GPT model for LLM tasks
- Scheduled jobs: TypeScript scripts run by GitHub Actions
- Tests: Vitest

## Security rules (non-negotiable)

- Every table has RLS enabled. Shared tables: `select` for `authenticated` only, no write policies. Per-user tables: owner-only (`user_id = (select auth.uid())`).
- Every per-user table ships with automated two-user tests (user A cannot read or modify user B's rows) in the same spec that creates it.
- Database functions read the user from `auth.uid()`; they never take a `user_id` parameter and run as `SECURITY INVOKER`. Views use `security_invoker = true`.
- The service-role key and OpenAI key are used only in server-side code and scripts; never in client components or `NEXT_PUBLIC_` variables. Never commit secrets; `.env*` files (except `.env.example`) are gitignored.
- Fetching external URLs: http/https only, timeouts, response size limits; block private/internal addresses when the URL comes from users or an LLM.

## Conventions

- Never edit an applied migration; add a new one.
- Ask before adding a new dependency.
- Keep LLM calls out of request-time ranking.
- Commands (to be confirmed after scaffolding): `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm ingest`.
