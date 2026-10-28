# 002 — Google login and feedback storage

**Status:** Draft  
**Milestone:** Prototype (week 2)  
**Depends on:** 001 (tables `sources`, `content_items`)  
**Estimate:** 7 h

## Goal

Let users sign in with Google and store their per-item feedback (_Like_, _Not interested_, _Seen_) so that only they can read or change it. This is the security foundation for every later per-user feature.

## Context

- Interaction model and actions: [design.md §7](../design.md#7-user-interaction)
- Feedback table: [design.md §6.3](../design.md#63-feedback-per-user)
- Security rules: [design.md §5.1](../design.md#51-data-access-and-security) and [AGENTS.md](../../AGENTS.md)
- Existing RLS test pattern: `lib/rls.integration.test.ts`

## In scope

- `@supabase/ssr` setup: server and browser clients, session refresh on every request, auth callback route, sign-out.
- Login page with a single "Sign in with Google" button; app routes redirect to it when there is no session.
- Supabase Auth Google provider for local development (`supabase/config.toml`, secrets via `env(...)`) and documented manual steps for the cloud project and Google Cloud OAuth client.
- Migration: `feedback` table with RLS, grants, and `updated_at` trigger.
- Server-side feedback functions: set (insert or replace) and clear (undo), using the signed-in user's session.
- Minimal signed-in page showing the user's email and a sign-out button (placeholder until spec 003).
- Two-user RLS integration tests and unit tests for input validation.

## Out of scope

- Feed UI, buttons, gestures, undo toast (spec 003).
- Allowlist and per-user usage limits (spec 004).
- Vercel deployment and production redirect URLs (spec 004).
- Click events (spec 006).

## Design notes

**Authentication**

- Follow the installed Next.js version's docs (`node_modules/next/dist/docs/`) for request interception and route handlers; this Next.js version may differ from older `middleware.ts` conventions.
- OAuth callback exchanges the code for a session and redirects to `/`; the `next` redirect target, if supported, must be a same-origin relative path (no open redirect).
- Google OAuth consent screen stays in Testing mode; only listed test users can sign in.
- Automated tests do not use Google. They create email/password users with the service-role admin API on local Supabase, as `lib/rls.integration.test.ts` already does.

**Feedback table** (see design.md §6.3)

- Primary key `(user_id, item_id)`: one row per user and item; latest action wins.
- `user_id` defaults to `auth.uid()`; FK to `auth.users` with `on delete cascade`.
- `item_id` FK to `content_items` with `on delete restrict`, so future pruning cannot silently remove items that users have rated.
- `kind` check: `like`, `not_interested`, `seen`. `via` check: `button`, `swipe`.
- `updated_at` maintained by a trigger.

**RLS and grants**

- `revoke all` from `anon` and `authenticated`, then grant `select`, `insert`, `delete` and column-level `update (kind, via)` to `authenticated`. Users can change the action on a row but never its `user_id` or `item_id`.
- Four owner-only policies using `(select auth.uid()) = user_id`; `insert` and `update` also use `with check`.

**Server-side functions**

- `setFeedback(itemId, kind, via)`: validates `itemId` as a UUID and `kind` / `via` against the allowed values, then upserts on `(user_id, item_id)`.
- `clearFeedback(itemId)`: validates and deletes the user's row (undo).
- Both use the request's Supabase session client, never the service role, and fail if there is no signed-in user.
- Exposed as Next.js server actions so spec 003 can call them from the UI.

## Acceptance criteria

1. Visiting `/` without a session redirects to the login page; after Google sign-in on local Supabase the user lands on `/` and sees their email; sign-out returns to the login page.
2. `supabase db reset` applies the new migration cleanly; `feedback` has RLS enabled and the constraints and defaults above.
3. Two-user RLS tests (users A and B):
   1. A can insert, read, update, and delete A's own rows.
   2. A cannot read, update, or delete B's rows (reads return nothing; writes affect 0 rows or fail).
   3. A cannot insert a row with `user_id` set to B.
   4. A cannot change `user_id` or `item_id` of an existing row.
   5. An anonymous client cannot read or write `feedback`.
4. Deleting a content item that has feedback fails; deleting a user removes their feedback.
5. Unit tests: `setFeedback` / `clearFeedback` reject invalid UUIDs, unknown `kind` or `via`, and missing sessions without calling the database.
6. Setting feedback twice for the same item leaves one row with the latest `kind` and `via`; clearing removes it.
7. No service-role key or OpenAI key is imported into any client component or `NEXT_PUBLIC_` variable.
8. `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.

## Tasks

- [ ] 1. Add `@supabase/ssr`; create server/browser client helpers and session refresh following the installed Next.js docs.
- [ ] 2. Configure the Google provider for local Supabase; document cloud and Google Cloud setup steps in README (no secrets).
- [ ] 3. Login page, auth callback route, sign-out, and redirect for unauthenticated requests (criterion 1).
- [ ] 4. Migration: `feedback` table, constraints, trigger, grants, RLS policies (criteria 2 and 4).
- [ ] 5. Two-user RLS integration tests (criteria 3, 4, 6).
- [ ] 6. `setFeedback` / `clearFeedback` server actions with input validation and unit tests (criterion 5).
- [ ] 7. Minimal signed-in placeholder page; verify criterion 7 and update design.md §6.3 if the implementation differs.

## Decisions

- Google is the only sign-in method in the UI; email/password users exist only in local automated tests.
- Undo deletes the row rather than storing history; the current state is all the recommender needs.
- `item_id` uses `on delete restrict` to protect rated items from future pruning.

## Open questions

- None.
