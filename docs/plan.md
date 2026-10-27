# AI-Powered Personal Content Discovery

**Version:** 1.0 — Project plan  
**Status:** Planning complete — ready for forum submission  
**Project type:** Solo AI course assignment  
**Duration:** 8 weeks (assumed 26 Oct – 20 Dec 2026)  
**Estimated workload:** 135 hours  
**Milestones:** Prototype + video 15–22 Nov 2026; final application December 2026  
**Long-term potential:** Standalone application

Related documents:

- [design.md](design.md) — technical design (sources, recommender, discovery, evaluation, stack, security, data model)
- [feeds.md](feeds.md) — feed catalog
- [specs/](specs/) — feature specs (one per feature, see [AGENTS.md](../AGENTS.md) for the workflow)
- [ai-log.md](ai-log.md) — log of significant AI-assisted work
- [course/plan-deliverable.md](course/plan-deliverable.md) — course forum submission

## 1. Project goal

Develop a web-based content aggregation system that learns a user's interests and recommends relevant links to news, articles, and other online content.

Unlike traditional RSS readers, the application should automatically personalize recommendations based on user interactions, requiring minimal manual configuration.

Content is in Finnish and English. The application is primarily a link list: clicking an item opens the original website.

The application supports multiple users (Google login); each user has a personal feed and interest profile.

The longer-term vision includes autonomous discovery of new content sources.

## 2. Concrete examples

**Example 1: Learning user preferences**

A user likes several English articles about Linux and artificial intelligence and marks entertainment news as not interesting.

The application gradually prioritizes articles about Linux, AI, and related topics — including Finnish articles on the same subjects, because the content representation is multilingual. Each recommendation can be explained, e.g. "Similar to _Ubuntu 26.04 released_, which you liked."

**Example 2: Discovering relevant sources**

The system recognizes that a user is interested in self-hosting and discovers a previously unknown technical blog with an RSS feed.

Articles from that blog become candidates for the personalized feed.

## 3. AI in the application (summary)

Technical details are in [design.md](design.md).

- **Semantic embeddings** (multilingual, Finnish + English) represent every article and video.
- **Recommender:** each item is scored by its similarity to the closest item the user liked, minus a penalty for similarity to items marked _Not interested_, combined with recency, diversity, and exploration slots. Every recommendation can be explained.
- **LLM tasks:** readable interest summary, source discovery with web search, and relevance labels for evaluation. The LLM does not rank items.
- **Evaluation:** replay test with simulated personas against average-vector, newest-first, and random baselines.

## 4. Deliverables

### 4.1 Prototype (proof of concept, video 15–22 Nov)

Goal: prove the core AI idea. The prototype is a rough first version that the final application grows from, not throwaway code.

- Manually run ingestion script: initial feeds ([design.md §1](design.md#1-content-sources-and-representation)), Finnish and English, including YouTube channels; normalization, deduplication, embeddings.
- Google login (Supabase Auth); feedback stored per user and protected by RLS.
- Automated two-user RLS tests for every per-user table, written together with the table. They must pass before deployment or testing with another person.
- Early ranking experiment and cross-lingual check ([design.md §4.1](design.md#41-early-checks-week-2-spec-001)).
- Minimal Next.js link list with _Like_ / _Not interested_ buttons.
- Recommender ranking ([design.md §2.1](design.md#21-interest-scoring-nearest-liked-item)) with recency and "why recommended" explanations.
- Runs on localhost against the cloud Supabase project.

Not included: scheduled jobs, deployment, exploration slots, interest summary, evaluation harness, source discovery.

**Video (2–3 min):**

1. Empty profile → varied feed.
2. Like 4–5 Linux/AI articles → feed re-ranks with explanations.
3. Finnish articles on the same topic appear (cross-lingual embeddings).
4. Mark sports as not interesting → sports articles drop.
5. Optional: compare against newest-first ordering.

### 4.2 Final application (December)

- Deployed on Vercel; access limited by an allowlist and per-user LLM usage limits.
- Scheduled ingestion via GitHub Actions.
- Exploration slots and diversity re-ranking.
- Evaluation harness and results ([design.md §4](design.md#4-evaluation)).
- Optional (see cut order in §9): LLM interest summary; click tracking as a weak positive signal.
- Stretch goal, only if gate 2 passes: source discovery ([design.md §3](design.md#3-source-discovery-stretch-goal)).
- Documentation and final demonstration.

## 5. Scope boundaries

Outside the course scope:

- Open public sign-up (access is limited to an allowlist)
- Per-user source subscriptions (all approved sources are shared)
- Video transcripts, podcasts, and research papers (videos are supported through YouTube channel feeds, metadata only)
- Autonomous web crawling
- Collaborative filtering, learned ranking models, bandit algorithms (possible later upgrades)
- Separate "For You" / "Discover" modes (covered by exploration slots)
- Bookmarks as a separate signal (treated as a like)
- Production-scale hosting

The content data model should stay generic enough to add other media types later.

## 6. Schedule

Week dates assume the course runs 26 Oct – 20 Dec 2026; the final deadline is confirmed in week 1.

### Phase 1 — Prototype

| Week | Dates          | Focus                                                                                                                                                                            | AI tool support                          | Hours |
| ---- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----- |
| 1    | 26 Oct – 1 Nov | Plan submission, confirm final deadline, project setup (Next.js, Supabase CLI, pgvector), Google OAuth configuration, start ingestion (fetch, parse, fixtures), LLM model choice | Research, scaffolding, parser drafts     | 16    |
| 2    | 2 – 8 Nov      | Finish ingestion and embeddings, cross-lingual check, **early ranking experiment (gate 1)**, Google login, feedback table with RLS and two-user tests                            | SQL and test drafts, experiment script   | 20    |
| 3    | 9 – 15 Nov     | Link list and feedback UI, recommender SQL function, recency, explanations, demo data — **prototype ready**                                                                      | SQL review, component generation         | 19    |
| 4    | 16 – 22 Nov    | **Record and submit prototype video**; Vercel deployment (only after RLS tests pass), GitHub Actions ingestion, allowlist and usage limits                                       | Deployment configuration, workflow files | 14    |

### Phase 2 — Final application

| Week | Dates          | Focus                                                                                                                                                                                         | AI tool support                    | Hours   |
| ---- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------- |
| 5    | 23 – 29 Nov    | Evaluation harness with protocol safeguards (time-based splits, identical histories, near-duplicate handling, repeated runs); LLM labels and manual agreement check; first validation results | Metric code, labeling scripts      | 18      |
| 6    | 30 Nov – 6 Dec | Exploration slots and diversity; optional LLM interest summary and click tracking; tune on validation set and **freeze parameters**; **gate 2 review**                                        | Debugging, algorithm review        | 16      |
| 7    | 7 – 13 Dec     | Final evaluation run on the test window; source discovery if gate 2 passed, otherwise hardening and fixes                                                                                     | Prompt design, feed parsing, tests | 12      |
| 8    | 14 – 20 Dec    | Final testing, documentation, demonstration, submission                                                                                                                                       | Documentation drafts               | 10      |
| —    |                | Buffer                                                                                                                                                                                        |                                    | 10      |
|      |                | **Total**                                                                                                                                                                                     |                                    | **135** |

## 7. Development approach

- Iterative: the prototype (week 3) is the first end-to-end version and is extended into the final application.
- AI coding tools (e.g. GitHub Copilot, ChatGPT) assist with scaffolding, repetitive code, tests, debugging, research, and documentation drafts.
- The developer is responsible for architecture decisions, reviewing all generated code, evaluation design, and validating results.
- Documentation distinguishes AI used **in the application** (embeddings, recommender, LLM tasks) from AI tools used **during development**.

## 8. Risks

| Risk                                                 | Mitigation                                                                                                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope grows too large                                | Fixed prototype scope; decision gates and cut order (§9); 10 h buffer                                                                                            |
| Prototype not ready for the video window             | Prototype ready by 15 Nov; week 4 is slack for re-recording                                                                                                      |
| Final deadline earlier than 20 Dec                   | Confirm in week 1; cut order (§9) shortens Phase 2                                                                                                               |
| Recommendations do not clearly beat baselines        | Early ranking experiment in week 2 (gate 1); a rigorous comparison counts as success either way                                                                  |
| Evaluation results inflated                          | Time-based splits, identical feedback histories, near-duplicate exclusion, frozen parameters, repeated runs ([design.md §4.3](design.md#43-protocol-safeguards)) |
| Little real feedback data (few users)                | Persona-based replay evaluation                                                                                                                                  |
| LLM labels are biased proxies                        | Manual agreement check reported overall and for Finnish vs English; different model family possible                                                              |
| Poor Finnish embedding quality                       | Multilingual model required; tested in week 1                                                                                                                    |
| Small or noisy content pool                          | Add Finnish topic-specific and non-tech feeds; balance by source                                                                                                 |
| Sparse text for some items (Hacker News titles only) | Accept for now; optionally fetch the linked page's meta description later                                                                                        |
| RSS feeds unreliable                                 | Multiple sources, robust error handling                                                                                                                          |
| API costs or provider changes                        | Limited LLM use, cached results, model name stored with embeddings                                                                                               |
| Source discovery too complex                         | Only attempted if gate 2 passes; first cut                                                                                                                       |
| LLM suggests invented or unsafe URLs                 | Every candidate fetched and validated; SSRF safeguards                                                                                                           |
| Free-tier limits (Vercel, Supabase)                  | Jobs on GitHub Actions; 512-dim embeddings; prune old articles                                                                                                   |
| Supabase free project pauses when idle               | Scheduled jobs keep it active; check before demos                                                                                                                |
| RLS mistakes leak another user's data                | Functions use `auth.uid()`, no `user_id` parameters; two-user tests written with each per-user table from week 2                                                 |
| Other users run up LLM costs                         | Allowlist, per-user limits, OAuth in Testing mode                                                                                                                |

## 9. Decision gates and cut order

**Gate 1 — end of week 2:** the early ranking experiment ([design.md §4.1](design.md#41-early-checks-week-2-spec-001)). If nearest-liked is not at least on par with average-vector and better than newest-first, investigate before building the UI around it; average-vector is the fallback ranking.

**Gate 2 — end of week 6:** source discovery starts only if all of these hold:

- the core application is deployed and working (ingestion, feed, feedback, recommender);
- the evaluation harness produces validation results and parameters are frozen;
- RLS tests pass.

Otherwise week 7 goes to hardening and fixes.

**Cut order** if time runs short:

1. Source discovery
2. LLM interest summary
3. Click tracking

The minimum acceptable result is: ingestion, personal feed with feedback, the recommender, RLS tests, and the baseline comparison.

**Success definition:** a rigorous, honest baseline comparison is a successful outcome even if the proposed recommender does not beat the baselines; the report then analyzes why.

## 10. Decisions made

- Solo course project, 8 weeks, 135 hours; may continue as a standalone application.
- Two submissions: prototype with video (15–22 Nov), final application (December).
- Link aggregator; clicking opens the original website.
- Multiple users with personal feeds; Google login via Supabase Auth; access limited by an allowlist.
- Row Level Security on all tables; shared content is read-only for users, per-user data is owner-only.
- RSS/Atom feeds (including YouTube channel feeds) are the content source; articles and videos, metadata only.
- Finnish and English supported from the start.
- Recommender: nearest-liked-item scoring with negative penalty, recency, diversity, and exploration slots.
- Average-vector, newest-first, and random as evaluation baselines.
- OpenAI for embeddings and LLM; LLM used for interest summary, source discovery (web search), and evaluation labels — not for ranking.
- Stack: Next.js on Vercel, Supabase Postgres + pgvector, supabase-js with SQL migrations (no ORM), Supabase Auth, GitHub Actions for scheduled jobs.
- Source discovery is a stretch goal, attempted only if gate 2 passes; admin-approved sources join a shared pool.
- Cut order: source discovery, LLM interest summary, click tracking.

## 11. Open decisions

- Exact OpenAI model for LLM tasks (week 1, based on price and Finnish quality)
- Parameter values (click weight, $\lambda$, recency decay, slot mix) — tuned through evaluation
- How long older but relevant articles stay in the feed
- Whether to add more YouTube channels or Finnish technology media to the active set
- Exact final submission date in December — **confirm in week 1**
- Per-user LLM limits (e.g. interest summaries per day, discovery runs per week)
