# AI-Powered Personal Content Feed — Project Plan

## What is the goal of your project? Give at least 1-2 concrete examples what it can achieve.

The goal is a web application that collects news, articles, and videos from RSS/Atom feeds (Finnish and English) and **learns what each user is interested in** from simple feedback: _Like_ and _Not interested_ (and optionally clicks). The feed is a list of links; clicking an item opens the original site. Users do not configure topics or subscriptions — the AI figures it out.

AI is the core of the application:

- Every item is converted into a **multilingual semantic embedding**, so the system understands topics regardless of language.
- The **recommender** scores each new item by its similarity to the closest item the user has liked, minus its similarity to items marked _Not interested_. Recency, diversity, and a share of exploratory items prevent a filter bubble. Every recommendation can be explained.
- An **LLM** writes a readable summary of each user's interests (optional feature) and labels data for the evaluation. As a stretch goal, the system discovers new sources: first by scoring catalog feeds against user interests, then with LLM web search.
- The recommender is **evaluated** with simulated users against simple baselines (newest first, random, average of liked items), using time-based data splits, identical feedback histories for every method, and repeated runs so the results are not inflated. A rigorous comparison counts as a result even if the recommender does not win.

**Example 1 — Learning interests across languages.** A user likes a few English articles about AI and software and marks sports news as not interesting. After a handful of interactions, AI and technology items rise to the top — including Finnish Yle articles on the same topics, because the embeddings are multilingual — and sports items drop out. Each item shows why it was recommended: _"Similar to 'X', which you liked."_

**Example 2 — Personal feeds from the same content.** User A likes car engineering videos (Engineering Explained, carwow); user B likes space and science news (NASA, New Scientist). From the same pool of content, their feeds diverge quickly. The evaluation measures this with precision@10 as feedback accumulates.

**Example 3 — Finding new sources (stretch goal).** The system notices a user's growing interest in space technology and finds that an inactive catalog feed (e.g. Quanta Magazine) matches it well; later, LLM web search can find a previously unknown blog. Each candidate's RSS feed is verified, and after admin approval its posts become candidates in the feed.

Deliverables: this plan (8 Nov), a proof-of-concept prototype with a demo video (22 Nov), and the final version (13 Dec).

## What technologies you plan to use? Be as specific as you can.

| Area                        | Technology                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend and backend        | Next.js (App Router, TypeScript), hosted on Vercel (Hobby, free)                                                                                                                     |
| Database                    | Supabase PostgreSQL with **pgvector** for vector similarity search; SQL migrations with Supabase CLI; supabase-js / `@supabase/ssr`                                                  |
| Authentication and security | Supabase Auth with Google login; **Row Level Security** so each user can access only their own feedback and profile                                                                  |
| Recommender                 | PostgreSQL SQL functions (cosine similarity with pgvector, recency, diversity)                                                                                                       |
| Embeddings                  | OpenAI `text-embedding-3-small` (multilingual, 512 dimensions)                                                                                                                       |
| LLM                         | OpenAI small GPT model via the Responses API: relevance labels for evaluation, interest summaries, and (stretch) web search for source discovery                                     |
| Content ingestion           | TypeScript scripts with `rss-parser`, run hourly by **GitHub Actions** from week 2                                                                                                   |
| Content sources             | 17 initial RSS/Atom feeds: Yle (Finnish and English), BBC World, Ars Technica, The Verge, TechCrunch, Hacker News, BleepingComputer, New Scientist, NASA, and three YouTube channels |
| Evaluation                  | TypeScript scripts (replay test, precision@10, diversity), results exported to CSV for charts; optionally a local model (Qwen via MTPLX on Apple Silicon) for relevance labels       |
| Testing                     | Vitest unit tests with saved real-feed fixtures; automated two-user Row Level Security tests                                                                                         |
| Development tools           | VS Code, GitHub Copilot (agent mode), ChatGPT, Git and GitHub                                                                                                                        |

Expected cost is under 10 € in total; only the OpenAI API is paid, everything else runs on free tiers.

## What are the risks related to this project e.g. what could make the project fail?

| Risk                                                                                  | Mitigation                                                                                                                                                                    |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope is too large for one person and 135 hours                                       | Fixed prototype scope; decision gates in week 2 and weeks 5–6; explicit cut order (web-search discovery, catalog discovery, interest summary, click tracking); 12-hour buffer |
| Recommendations do not clearly beat simple baselines                                  | Small ranking experiment already in week 2 against average-vector and newest-first; a rigorous comparison counts as success either way                                        |
| Evaluation results look better than they are                                          | Time-based splits, identical feedback histories, exclusion of near-duplicate stories, parameters frozen before the final test run, at least 10 repeated runs                  |
| Hard to prove that the AI helps, because there are few real users and little feedback | Simulated personas with LLM relevance labels treated as proxies; agreement with ~100 manual labels reported, separately for Finnish and English                               |
| Poor embedding quality for Finnish                                                    | Tested in week 2 with Finnish–English article pairs from Yle; switch model if needed                                                                                          |
| One user's data leaks to another                                                      | Row Level Security on every table; database functions use the logged-in user only; two-user tests written with each per-user table from week 2 and required before deployment |
| API costs grow (other users, web search)                                              | Login allowlist and per-user limits; the LLM is not used for ranking; embeddings are cheap                                                                                    |
| Free-tier limits and unreliable feeds                                                 | Scheduled jobs on GitHub Actions instead of Vercel; small embeddings; per-feed error handling                                                                                 |
| The LLM suggests invented or unsafe URLs during discovery                             | Every candidate is fetched and validated; protection against requests to internal addresses; admin approval                                                                   |
| Prototype not ready for the video deadline                                            | Prototype targeted for 15 Nov, leaving the following week for recording                                                                                                       |
| Final phase is only three weeks (deadline 13 Dec)                                     | Ingestion runs from week 2 so evaluation data is ready early; documentation is written continuously; the cut order shortens the final phase                                   |

Minimum acceptable result if time runs short: ingestion, personal feed with feedback, the recommender, RLS tests, and the baseline comparison. Source discovery is attempted only after the core application, evaluation, and security checks are done (at the latest by the end of week 6).

## Make a weekly schedule (what each group member does each week and how many hours you think it takes). Plan also the utilization of AI tools.

This is a solo project: I do all the work. Total 135 hours over 7 weeks, about 19 hours per week. Most code is written by AI agents, so implementation may run ahead of these estimates; saved time goes to the stretch goals.

| Week | Dates          | Work                                                                                                                                                                                                                                            | AI tool usage                                                                                                         | Hours   |
| ---- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------- |
| 1    | 26 Oct – 1 Nov | Set up Next.js, Supabase, pgvector, Google login configuration; start feed ingestion (fetching, parsing); choose LLM model; polish plan                                                                                                         | Plan review and research (ChatGPT/Copilot), project scaffolding and parser drafts (Copilot)                           | 16      |
| 2    | 2 – 8 Nov      | Finish ingestion and embeddings; **hourly ingestion with GitHub Actions**; Finnish–English embedding check; **early ranking experiment** (decision gate 1); Google login; feedback storage with RLS and two-user tests; **submit plan (8 Nov)** | Copilot generates SQL migrations, tests, the workflow, and the experiment script; I review policies and judge results | 21      |
| 3    | 9 – 15 Nov     | Link list and feedback UI, recommender SQL function, recency, "why recommended" explanations, demo data — **prototype ready**                                                                                                                   | Copilot for SQL and component drafts; AI review of the ranking query                                                  | 19      |
| 4    | 16 – 22 Nov    | **Record and submit prototype video (22 Nov)**; deploy to Vercel (after RLS tests pass); allowlist and usage limits                                                                                                                             | Copilot for deployment configuration                                                                                  | 13      |
| 5    | 23 – 29 Nov    | Evaluation harness: data snapshot, time-based splits, personas, LLM relevance labels and manual agreement check, replay test, baselines, repeated runs                                                                                          | LLM (in the app) labels test data; Copilot for metric code                                                            | 19      |
| 6    | 30 Nov – 6 Dec | Exploration slots and diversity; optional interest summary and click tracking; tune on validation data and freeze parameters; **decision gate 2**                                                                                               | Copilot for debugging; AI review of algorithm choices                                                                 | 19      |
| 7    | 7 – 12 Dec     | Final evaluation run on held-out test data; documentation and demonstration; **submit final version (13 Dec)**; source discovery only if gate 2 passed earlier                                                                                  | AI drafts documentation; I edit and verify                                                                            | 16      |
| —    |                | Buffer                                                                                                                                                                                                                                          |                                                                                                                       | 12      |
|      |                | **Total**                                                                                                                                                                                                                                       |                                                                                                                       | **135** |

**Use of AI tools during development**

- **Spec-driven workflow:** each feature gets a short spec (goal, scope, testable acceptance criteria, task list) written with AI and approved by me. A coding agent implements one task at a time following project rules in `AGENTS.md` (stack, security rules), runs lint, type checks, and tests, and I review and commit each step. Specs are written just in time, one ahead of implementation.
- **GitHub Copilot (agent mode in VS Code):** scaffolding, SQL migrations and RLS policies, ingestion and parsing code, UI components, tests, debugging.
- **ChatGPT / Copilot chat:** research, comparing technical alternatives, reviewing designs. This plan itself was developed iteratively with an AI assistant that challenged assumptions about scope, recommendation methods, and evaluation, and then reviewed by a separate AI agent whose findings (evaluation safeguards, earlier experiments, decision gates) were incorporated.
- **My responsibility:** architecture decisions, reviewing all generated code (especially security policies and evaluation logic), integration, and validating results.
- **Local model experiment:** a few well-specified tasks are also tried with a local coding model (Qwen via MTPLX) and compared with the cloud agent.
- I keep a short log of significant AI-assisted steps for the final report.

**AI inside the application** (separate from development tools): multilingual embeddings, the embedding-based recommender, LLM relevance labels for evaluation, LLM interest summaries, and (stretch) source discovery with embeddings and LLM web search. The final documentation will keep these two uses of AI clearly separate.
