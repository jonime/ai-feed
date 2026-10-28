# Technical Design

Companion to [plan.md](plan.md). Describes _how_ the application works; the plan describes _what_ is delivered and _when_.

## 1. Content sources and representation

The full catalog of candidate feeds is in [feeds.md](feeds.md) (all verified on 27 Oct 2026 except Reddit, which returns HTTP 429). The initial active set is chosen for topic diversity, Finnish + English coverage, and usable descriptions:

| Topic                     | Sources                                                                      | Language |
| ------------------------- | ---------------------------------------------------------------------------- | -------- |
| Finnish news              | Yle Latest, Yle Technology and Economy, Yle Science, Yle Culture, Yle Sports | fi       |
| Finnish news in English   | Yle News in English                                                          | en       |
| World news                | BBC World                                                                    | en       |
| Technology and AI         | Ars Technica, The Verge, TechCrunch, Hacker News                             | en       |
| Security                  | BleepingComputer                                                             | en       |
| Science and space         | New Scientist, NASA News Releases                                            | en       |
| Videos (cars, technology) | Engineering Explained, carwow, Technology Connections (YouTube)              | en       |

Not used initially:

- **Subsets or aggregators that duplicate other feeds:** Yle Main Headlines and Most Read, TechCrunch AI, Techmeme.
- **Paywalled, tabloid, or very high volume:** Helsingin Sanomat, Ilta-Sanomat, Iltalehti, Phys.org, ScienceDaily.
- **Regional or niche:** regional newspapers, SAK, AWS Blog, Finland Today.
- **No usable text:** Nature (empty descriptions), xkcd (image only).
- **Blocked:** Reddit (HTTP 429; requires its API).

The rest of the catalog is stored as inactive sources and can be activated later. Source discovery evaluates these catalog sources before using web search, which is cheaper and safer.

Notes:

- Hacker News items have only a title; Yle items sometimes lack a description. YouTube descriptions contain a lot of boilerplate that is removed before embedding.
- Yle News in English and Finnish Yle feeds often cover the same events, which gives natural test pairs for the week 1 cross-lingual embedding check.
- Feed windows are small (e.g. Yle Latest shows only the 20 newest items, all within a few hours), so ingestion runs **hourly** to avoid missing items.
- The same Yle article can appear in several Yle feeds; it is stored once (unique normalized URL).
- Volume is uneven (Yle publishes far more than the others), so the cold-start feed and exploration slots balance by source.
- URLs are normalized by removing tracking parameters (e.g. `?origin=rss`, `?at_medium=RSS&at_campaign=rss`) and deduplicated on the normalized URL. The same story from several sources (e.g. Verge + TechCrunch + Hacker News) is handled by diversity re-ranking, not deduplication.
- Feed category tags (Yle, Verge, TechCrunch) are stored for diversity measurement and evaluation, not used for ranking.
- Only title, short description, thumbnail, and link are shown; Yle and BBC RSS terms of use are reviewed in week 1.

Representation:

- Each item has a type: _article_ or _video_. Videos come from YouTube channel feeds; only metadata is used (no transcripts). Boilerplate in video descriptions (links, sponsor and subscribe text) is removed before embedding.
- Each item's title and description are converted into a semantic embedding.
- The embedding model must be **multilingual (Finnish + English)** so that interests transfer across languages.
- The embedding model name is stored with each vector, so embeddings can be regenerated if the model changes.

## 2. Recommendation

The core recommender is embedding-based. An LLM is used only for tasks that embeddings cannot handle well.

### 2.1 Interest scoring: nearest liked item

A candidate item is scored by its similarity to the _closest_ item the user has reacted to, not to an averaged profile:

$$
\text{interest}(c) = \max_{p \in P} w_p \cdot \text{sim}(c, p) \;-\; \lambda \cdot \max_{n \in N} \text{sim}(c, n)
$$

- $P$ = positive interactions. Likes have weight 1.0; clicks have a lower weight (e.g. 0.3) because they are a weak signal.
- $N$ = items marked _Not interested_. $\lambda$ controls the strength of the penalty.
- Skipped or ignored items are not used as negative feedback.
- Items marked _Seen_ are hidden from the feed but are neutral: they are neither positive nor negative signals ([§7](#7-user-interaction)).
- Signal precedence per item: explicit feedback overrides clicks. If an item is liked or marked _Not interested_, only that signal counts (the latest explicit action wins). Clicks count only for items without explicit feedback.
- Click tracking is optional (see the cut order in [plan.md §9](plan.md#9-decision-gates-and-cut-order)); the recommender works with explicit feedback alone.

Why this approach:

- Handles multiple unrelated interests (an averaged profile of "Linux + astronomy" matches neither well).
- Works with very little feedback (a handful of likes).
- Explainable: the closest liked item is the reason for the recommendation.

### 2.2 Final ranking and exploration

- Final score combines interest score and a recency boost (news loses relevance within days).
- A diversity step (MMR) prevents near-duplicate items from filling the list.
- Each feed page is composed of slots (initial values, tuned during evaluation):
  - ~70% best-matching items
  - ~20% related but unfamiliar items (moderate similarity band)
  - ~10% exploratory items (topics/sources the user rarely engages with)

### 2.3 Cold start

With an empty profile, the feed shows recent items balanced across sources and topics. Personalization starts after the first few likes.

### 2.4 Baselines (evaluation only)

- **Average vector:** rank by similarity to the mean embedding of liked items.
- **Newest first.**
- **Random.**

### 2.5 LLM usage (limited)

OpenAI API (a small, low-cost GPT model, chosen in week 1). The LLM is **not** used to rank individual items (cost, latency, reproducibility). It is used for:

1. **Interest summary** (optional): periodically turns likes/dislikes into a readable profile shown to the user.
2. **Evaluation judge:** labels test items as relevant/not relevant for simulated personas.
3. **Source discovery** (stretch, stage b): finds candidate sites with the built-in web search tool and assesses source quality.

## 3. Source discovery (stretch goal)

Two independent stages, both attempted only after gate 2 ([plan.md §9](plan.md#9-decision-gates-and-cut-order)). Both feed the same validation and approval steps.

**Stage (a) — catalog-based (no LLM, ~5 h):** inactive sources from the catalog ([feeds.md](feeds.md)) are fetched, their recent items embedded and scored against each user's liked items. Sources that match well are proposed to the admin.

**Stage (b) — LLM web search (~6–8 h):** the LLM, using web search and the interest summary, suggests candidate sites. The LLM only _suggests_; deterministic code verifies.

Validation and approval (both stages):

1. Fetch each site and detect RSS/Atom feeds (autodiscovery). Feed URLs proposed by the LLM are never trusted without fetching.
2. Parse the feed: is it active, with recent posts?
3. Embed recent items and score them against the user's interests; in stage (b) the LLM also assesses source quality.
4. An admin approves a source before it is ingested. Approved sources join the shared source pool; each user's recommender decides whether its items are relevant to them.

Optional extra candidate source: outbound links from liked articles, fed into the same validation pipeline.

Safeguards: discovery runs manually or weekly with a cap on searches per run; fetching is restricted to http/https, blocks private/internal addresses (SSRF), and enforces timeouts and response size limits.

The core recommender must work without this feature.

## 4. Evaluation

Goal: a rigorous comparison of the recommender against simple baselines. A careful comparison is a successful result even if the recommender does not win; the report then analyzes why.

### 4.1 Early checks (week 2, [spec 001](specs/001-ingestion.md))

- **Cross-lingual check:** Finnish–English pairs of the same event (Yle News in English vs Finnish Yle feeds) must be clearly more similar than random pairs.
- **Early ranking experiment:** a fixed bilingual sample of ~300 items; for 2 personas, ~5 hand-picked liked items each (at least one Finnish). Rank the rest with nearest-liked, average-vector, and newest-first, then judge the top 10 of each by hand. The three lists are merged and shuffled before judging, so the method behind each item is not visible.
- **Gate 1:** if nearest-liked is not at least on par with average-vector and better than newest-first, investigate (embedding input text, $\lambda$, sample) before building the UI around it. Average-vector is the fallback ranking; the rest of the application does not depend on the choice.
- The sample is small, so the result is indicative only; it is recorded in [ai-log.md](ai-log.md).

### 4.2 Dataset and labels

1. Freeze a snapshot of ~1.5–2k items covering at least two weeks.
2. Define 3–4 personas as text descriptions (e.g. "AI and software", "cars and engineering", "science and space", "Finnish sports"). Each persona is a real user in the database, so the replay also exercises the multi-user setup and RLS.
3. An LLM labels each item's relevance per persona. These labels are **proxy judgments**, not independent ground truth. Using a different model family than the embedding provider (e.g. a local Qwen model) reduces shared bias.
4. Manually label ~100 items, balanced between Finnish and English. Report agreement with the LLM labels (percent agreement and Cohen's κ) overall and separately for Finnish and English.

### 4.3 Protocol safeguards

- **Time-based split:** items are ordered by publication time into a feedback window (oldest ~50%), a validation window (~25%), and a test window (newest ~25%). Feedback comes only from the feedback window; candidates come only from later windows. This mirrors real use and prevents leakage.
- **Identical feedback histories:** for each persona and run, one feedback sequence is sampled from the feedback window independently of any method (relevant items as likes, a fixed share of non-relevant items as _Not interested_). Every method receives exactly the same sequence.
- **Rated items are excluded** from every method's candidates.
- **Near-duplicates:** candidates with cosine similarity above a threshold fixed in advance (e.g. 0.9) to any feedback item are excluded from the headline metric, since the same story from several sources would inflate nearest-neighbor matching. Results including them are reported separately.
- **Tuning only on the validation window.** Parameters ($\lambda$, recency weight, click weight, slot mix) are frozen and recorded (commit hash) before a single run on the test window.
- **Repeated runs:** at least 10 runs with different random seeds for feedback sampling; report the mean and spread (standard deviation or 95% interval) per method.

### 4.4 Metrics

- Precision@10 as a function of the number of feedback items (e.g. 0, 3, 5, 10, 20), for the recommender and all baselines.
- Topic diversity of the top 10 (distinct categories and sources).
- Divergence between persona rankings.
- Cross-lingual retrieval: share of relevant Finnish items ranked in the top 10 from English-only feedback, and vice versa.

Limitation: this demonstrates adaptation in a controlled setting, not real-world recommendation accuracy.

## 5. Technology stack

Guiding principle: lowest possible cost, single language (TypeScript).

| Part                 | Choice                                                                                                | Cost          |
| -------------------- | ----------------------------------------------------------------------------------------------------- | ------------- |
| Frontend and API     | Next.js (App Router, TypeScript) on Vercel Hobby                                                      | Free          |
| Database and vectors | Supabase Postgres + pgvector                                                                          | Free tier     |
| Database access      | supabase-js (`@supabase/ssr` in Next.js), SQL migrations via Supabase CLI, generated TypeScript types | Free          |
| Authentication       | Supabase Auth with Google login                                                                       | Free          |
| Scheduled jobs       | GitHub Actions scheduled workflow running TypeScript scripts                                          | Free          |
| Embeddings           | OpenAI `text-embedding-3-small`, 512 dimensions                                                       | < 1 €/month   |
| LLM                  | OpenAI small GPT model, Responses API with web search                                                 | A few € total |
| RSS parsing          | `rss-parser` or similar                                                                               | Free          |

Implementation notes:

- Recommender and baseline scoring are Postgres SQL functions called via RPC, so vectors never leave the database.
- Scheduled jobs run outside Vercel to avoid Hobby cron and function timeout limits; regular jobs also prevent the Supabase free project from pausing.
- Hourly ingestion uses roughly 700–800 GitHub Actions minutes per month, within the 2,000 free minutes for private repositories (unlimited for public ones).
- 512-dimension embeddings and pruning of old items keep the database within the 500 MB free limit.
- Evaluation scripts are TypeScript; results are exported as CSV/JSON for charts.
- Vercel Hobby is non-commercial only; a paid plan is needed if the project becomes a product.
- Google OAuth consent screen stays in "Testing" mode during the course (only listed test users can log in).

### 5.1 Data access and security

All user-facing queries run through supabase-js with the user's session, so Row Level Security (RLS) is enforced by the database.

| Data     | Examples                                           | Read                                | Write                                |
| -------- | -------------------------------------------------- | ----------------------------------- | ------------------------------------ |
| Shared   | `sources`, content items                           | Any logged-in user                  | Service role only (ingestion, admin) |
| Per-user | feedback, interest summaries, discovery candidates | Owner only (`user_id = auth.uid()`) | Owner only                           |

Rules:

- RLS is enabled on every table.
- Feed and scoring functions read the user from `auth.uid()` internally and never accept a `user_id` parameter; they run as `SECURITY INVOKER`.
- Views are created with `security_invoker = true`.
- The service-role key is used only in GitHub Actions secrets and server-only environment variables, never in `NEXT_PUBLIC_` variables.
- RLS does not limit cost: LLM-triggering actions are restricted by an allowlist and per-user limits.
- Policies are covered by automated tests with two users.

## 6. Data model

Tables are added by the spec that first needs them. Shared tables are readable by any logged-in user and writable only with the service role (§5.1).

### 6.1 `sources` (shared)

| Column                               | Type               | Notes                                               |
| ------------------------------------ | ------------------ | --------------------------------------------------- |
| `id`                                 | `uuid` PK          |                                                     |
| `name`                               | `text`             | e.g. "Yle — Science"                                |
| `feed_url`                           | `text` unique      |                                                     |
| `site_url`                           | `text` null        |                                                     |
| `kind`                               | `text`             | `rss` or `youtube` (RSS also covers Atom)           |
| `language`                           | `text`             | `fi` or `en`; set per source, not detected per item |
| `is_active`                          | `boolean`          | Initial set active, rest of the catalog inactive    |
| `etag`, `last_modified`              | `text` null        | Conditional GET                                     |
| `last_fetched_at`, `last_success_at` | `timestamptz` null |                                                     |
| `last_error`                         | `text` null        | Last fetch/parse error                              |
| `created_at`                         | `timestamptz`      |                                                     |

### 6.2 `content_items` (shared)

| Column            | Type                  | Notes                                      |
| ----------------- | --------------------- | ------------------------------------------ |
| `id`              | `uuid` PK             |                                            |
| `source_id`       | `uuid` FK → `sources` | First source that delivered the item       |
| `type`            | `text`                | `article` or `video`                       |
| `url`             | `text` unique         | Normalized URL; deduplication key          |
| `title`           | `text`                | Plain text                                 |
| `summary`         | `text` null           | Plain text, cleaned, max ~1,000 characters |
| `language`        | `text`                | Copied from the source                     |
| `categories`      | `text[]`              | Feed category tags; not used for ranking   |
| `thumbnail_url`   | `text` null           |                                            |
| `published_at`    | `timestamptz`         | Falls back to fetch time                   |
| `embedding`       | `vector(512)` null    | Null until embedded                        |
| `embedding_model` | `text` null           | e.g. `text-embedding-3-small@512`          |
| `created_at`      | `timestamptz`         |                                            |

Indexes: `published_at desc`; an HNSW index on `embedding` is added only if exact search becomes slow (tens of thousands of rows are fine without it).

### 6.3 `feedback` (per-user)

One row per user and item; the current state only (latest action wins). Undo deletes the row.

| Column                     | Type                        | Notes                                                    |
| -------------------------- | --------------------------- | -------------------------------------------------------- |
| `user_id`                  | `uuid` FK → `auth.users`    | Part of PK; defaults to `auth.uid()`                     |
| `item_id`                  | `uuid` FK → `content_items` | Part of PK                                               |
| `kind`                     | `text`                      | `like`, `not_interested`, or `seen`                      |
| `via`                      | `text`                      | `button` or `swipe`; used to analyze accidental gestures |
| `created_at`, `updated_at` | `timestamptz`               |                                                          |

RLS: owner-only `select`, `insert`, `update`, `delete`; covered by two-user tests.

### 6.4 Later tables

Click events, interest summaries, discovery candidates, allowlist — defined in their specs.

## 7. User interaction

The feed is a single column of compact cards, responsive for phone and desktop. Each card shows title, source, time, thumbnail (if any), and a one-line explanation.

### 7.1 Actions

| Action           | Button     | Touch gesture | Signal   | Effect in the feed                                                      |
| ---------------- | ---------- | ------------- | -------- | ----------------------------------------------------------------------- |
| _Like_           | 👍         | Swipe right   | Positive | Card stays, marked as liked                                             |
| _Not interested_ | 👎         | Swipe left    | Negative | Card collapses immediately                                              |
| _Seen_           | ✓ ("Seen") | —             | Neutral  | Card collapses immediately; for items already read or watched elsewhere |

- Pressing the active button again undoes the action; choosing another action replaces it.
- Every action that hides a card shows a short **Undo** toast.
- Buttons are always available on every device; gestures are a touch shortcut, not the only way (accessibility).
- Rated items (any action) do not return in the feed. A _Liked_ page lists liked items.
- _Seen_ is a button only, so that swipe-left keeps a single meaning.

### 7.2 Gesture safeguards

Swipe-to-dismiss is a common habit (e.g. in email), so a left swipe meaning "already seen" could be recorded as _Not interested_. Safeguards:

- The swipe reveals a colored background with an icon and label ("Like" / "Not interested") and only commits past a threshold (~40% of card width).
- Horizontal swipes lock direction so vertical scrolling is never misread as a swipe.
- Undo toast after every swipe.
- Feedback records `via` (`button` / `swipe`), so undo rates by input method can be measured and reported.

### 7.3 Ranking updates

The ranking does not reorder while the user is interacting. New feedback takes effect on the next load or when the user presses **Refresh feed**.

### 7.4 Explanations

- Personalized items: "Similar to _X_, which you liked".
- Exploration slots: "Exploring: something new".
- Cold start: "Recent from _source_".

### 7.5 Not included

Reasons for dislikes ("not this topic" / "not this source"), hiding a whole source, and impression tracking are possible later additions.

**Implicit skip signals** (scrolling quickly past an item as a weak negative) are deliberately left out:

- Scrolling past is ambiguous: the user may have already read the story elsewhere, got enough from the title, or been in a hurry. Lower positions are skipped more just because of their position.
- Most items are skipped, so even small negative weights would add up and, with the nearest-item penalty, push down whole topics.
- It needs impression tracking (which cards were visible and for how long) and would have to be simulated in the evaluation, where realistic skip behavior is hard to model.

If added later, the safer variant is "skip above click": items shown above a clicked item without any interaction get a small negative weight. It requires click tracking and a log of the ordered item IDs per feed load.
