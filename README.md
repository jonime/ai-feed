# AI Feed

An AI-powered personal content feed. It collects news, articles, and videos from Finnish and English RSS/Atom/YouTube feeds and learns what each user is interested in from simple feedback (_Like_, _Not interested_, clicks). The feed is a list of links; clicking an item opens the original site.

> **Status:** Planning complete. Implementation starts with [spec 001](docs/specs/001-ingestion.md).  
> Solo project for an AI course (8 weeks, 135 h): prototype with demo video 15–22 Nov 2026, final application December 2026.

## How it uses AI

- **Multilingual embeddings** represent every item, so interests transfer between Finnish and English content.
- **Recommender:** each item is scored by its similarity to the closest item the user liked, minus similarity to items marked _Not interested_, combined with recency, diversity, and exploration. Every recommendation is explained ("Similar to _X_, which you liked").
- **LLM tasks:** readable interest summaries, source discovery with web search (stretch goal), and relevance labels for evaluation. The LLM does not rank items.
- **Evaluation:** replay tests with simulated users against newest-first, random, and average-vector baselines.

## Tech stack

Next.js (App Router, TypeScript) on Vercel · Supabase Postgres + pgvector · Supabase Auth (Google) with Row Level Security · OpenAI embeddings and LLM · GitHub Actions for scheduled ingestion · Vitest

## Documentation

| Document                         | Contents                                                    |
| -------------------------------- | ----------------------------------------------------------- |
| [docs/plan.md](docs/plan.md)     | Goals, deliverables, scope, schedule, risks, decisions      |
| [docs/design.md](docs/design.md) | Architecture, recommender, evaluation, security, data model |
| [docs/feeds.md](docs/feeds.md)   | Feed catalog                                                |
| [docs/specs/](docs/specs/)       | Feature specs (spec-driven development)                     |
| [docs/ai-log.md](docs/ai-log.md) | Log of AI-assisted development work                         |
| [AGENTS.md](AGENTS.md)           | Instructions for AI coding agents                           |

## Getting started

Setup instructions will be added once the project is scaffolded (spec 001, task 1).
