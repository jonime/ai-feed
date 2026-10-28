/**
 * Database writes for the ingestion pipeline (spec 001, task 6).
 *
 * Ingestion is the only writer of the shared tables. It always runs with the
 * service-role key (server-side only; design §5.1), and the migration
 * 20261028000000 keeps every other role read-only (RLS enabled, `select`
 * granted to `authenticated`, nothing else).
 *
 * Two write paths, both idempotent so a re-run is always safe:
 *
 * - `insertItems` — inserts one source's parsed items with
 *   `insert … on conflict (url) do nothing`. The first source to deliver an
 *   item wins; only newly inserted rows are counted/returned, so "new items"
 *   per source is exact and a repeat run reports 0.
 * - `updateSource` — applies a status patch (`etag`, `last_modified`,
 *   `last_fetched_at`, `last_success_at`, `last_error`) built by
 *   {@link patchForOutcome}, so a failing source is recorded without
 *   stopping the run.
 *
 * The {@link IngestDb} interface is deliberately narrow so the pipeline can
 * be unit-tested with a fake; {@link createIngestDb} is the supabase-js
 * adapter used by the `pnpm ingest` command (task 8).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ParsedItem } from "./normalize/parse.ts";

/** A row from the shared `sources` table (camelCase). */
export interface Source {
  id: string;
  name: string;
  feedUrl: string;
  siteUrl: string | null;
  kind: "rss" | "youtube";
  /** Set per source, not detected per item. */
  language: "fi" | "en";
  isActive: boolean;
  etag: string | null;
  lastModified: string | null;
  /** ISO timestamp string or null, as returned by PostgREST. */
  lastFetchedAt: string | null;
  lastSuccessAt: string | null;
  /** Human-readable last fetch/parse error, or null. */
  lastError: string | null;
  createdAt: string;
}

/**
 * Status fields an ingestion run may change on a `sources` row. Only the
 * keys present in the patch are written, so e.g. a fetch error never
 * clobbers the stored conditional-GET state.
 */
export interface SourceStatusPatch {
  etag?: string | null;
  lastModified?: string | null;
  lastFetchedAt?: Date | null;
  lastSuccessAt?: Date | null;
  lastError?: string | null;
}

/**
 * What happened with one source during an ingestion run.
 *
 * - `fetched` — HTTP 200 and parsed successfully. The stored
 *   etag/last-modified are replaced only when the server sent new values;
 *   a missing header keeps the previous working state.
 * - `not_modified` — HTTP 304; the fetch is confirmed successful.
 * - `error` with phase `fetch` — network/HTTP failure. The conditional-GET
 *   state and `last_success_at` are kept, so the next run retries
 *   conditionally.
 * - `error` with phase `parse` — the body arrived but could not be parsed.
 *   The conditional-GET state is cleared so the next run re-fetches
 *   unconditionally; otherwise a persistently unparseable feed whose etag
 *   never changes would answer 304 forever and never be ingested.
 */
export type SourceOutcome =
  | {
      kind: "fetched";
      /** Number of newly inserted items from this fetch. */
      newItems: number;
      etag?: string;
      lastModified?: string;
    }
  | { kind: "not_modified" }
  | { kind: "error"; phase: "fetch" | "parse"; error: string };

/**
 * The database surface the ingestion pipeline needs.
 *
 * Kept narrow on purpose so it can be faked in unit tests; the supabase-js
 * implementation is {@link createIngestDb}.
 */
export interface IngestDb {
  /** All sources with `is_active = true`, ordered by name. */
  listActiveSources(): Promise<Source[]>;

  /** Content rows with no embedding, ordered by creation time. */
  listUnembeddedItems(): Promise<UnembeddedItem[]>;

  /** Save a vector only if this item is still unembedded. */
  saveEmbedding(
    id: string,
    embedding: number[],
    model: string,
  ): Promise<boolean>;

  /**
   * Insert one source's parsed items, deduplicated on the normalized
   * `url` (`insert … on conflict (url) do nothing`; the first source to
   * deliver a URL wins). Items without a usable http(s) URL are skipped.
   *
   * @returns the number of newly inserted rows (conflicts are skipped).
   */
  insertItems(
    source: Pick<Source, "id" | "language">,
    items: ParsedItem[],
  ): Promise<number>;

  /** Apply a status patch to one `sources` row. */
  updateSource(id: string, patch: SourceStatusPatch): Promise<void>;
}

/** Content fields needed to create an embedding. */
export interface UnembeddedItem {
  id: string;
  title: string;
  summary: string | null;
}

/* ------------------------------------------------------------------ *
 * Pure builders (unit-tested directly)
 * ------------------------------------------------------------------ */

/** The row shape written to `content_items` (snake_case for PostgREST). */
export interface ContentItemRow {
  source_id: string;
  type: "article" | "video";
  url: string;
  title: string;
  /** null when the item has no summary (e.g. Hacker News). */
  summary: string | null;
  language: "fi" | "en";
  categories: string[];
  thumbnail_url: string | null;
  published_at: Date;
}

function hasUsableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Map normalized items to `content_items` rows.
 *
 * `language` is copied from the source (design §6.2); an empty summary
 * becomes `null`; items without a usable http(s) URL are skipped because a
 * URL is the deduplication key.
 */
export function toContentItemRows(
  source: Pick<Source, "id" | "language">,
  items: ParsedItem[],
): ContentItemRow[] {
  return items
    .filter((item) => hasUsableUrl(item.url))
    .map((item) => ({
      source_id: source.id,
      type: item.type,
      url: item.url,
      title: item.title,
      summary: item.summary === "" ? null : item.summary,
      language: source.language,
      categories: item.categories,
      thumbnail_url: item.thumbnailUrl,
      published_at: item.publishedAt,
    }));
}

/**
 * Build the `sources` status patch for one source's outcome (see
 * {@link SourceOutcome} for the per-outcome semantics).
 */
export function patchForOutcome(
  outcome: SourceOutcome,
  now: Date = new Date(),
): SourceStatusPatch {
  switch (outcome.kind) {
    case "fetched": {
      const patch: SourceStatusPatch = {
        lastFetchedAt: now,
        lastSuccessAt: now,
        lastError: null,
      };
      // Replace the stored conditional-GET state only when the server sent
      // new values; keep whatever worked before otherwise.
      if (outcome.etag !== undefined) patch.etag = outcome.etag;
      if (outcome.lastModified !== undefined) {
        patch.lastModified = outcome.lastModified;
      }
      return patch;
    }
    case "not_modified":
      return { lastFetchedAt: now, lastSuccessAt: now, lastError: null };
    case "error":
      return {
        lastFetchedAt: now,
        lastError: outcome.error,
        ...(outcome.phase === "parse"
          ? { etag: null, lastModified: null }
          : {}),
      };
  }
}

/** Record one source's outcome with a single `updateSource` call. */
export async function recordSourceOutcome(
  db: IngestDb,
  sourceId: string,
  outcome: SourceOutcome,
  now: Date = new Date(),
): Promise<void> {
  await db.updateSource(sourceId, patchForOutcome(outcome, now));
}

/* ------------------------------------------------------------------ *
 * supabase-js adapter (service role)
 * ------------------------------------------------------------------ */

const SOURCE_COLUMNS =
  "id,name,feed_url,site_url,kind,language,is_active,etag,last_modified,last_fetched_at,last_success_at,last_error,created_at";

/** A `sources` row exactly as returned by PostgREST (snake_case). */
interface RawSourceRow {
  id: string;
  name: string;
  feed_url: string;
  site_url: string | null;
  kind: string;
  language: string;
  is_active: boolean;
  etag: string | null;
  last_modified: string | null;
  last_fetched_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
}

function toSource(row: RawSourceRow): Source {
  return {
    id: row.id,
    name: row.name,
    feedUrl: row.feed_url,
    siteUrl: row.site_url,
    // The check constraints guarantee these values; normalize defensively.
    kind: row.kind === "youtube" ? "youtube" : "rss",
    language: row.language === "en" ? "en" : "fi",
    isActive: row.is_active,
    etag: row.etag,
    lastModified: row.last_modified,
    lastFetchedAt: row.last_fetched_at,
    lastSuccessAt: row.last_success_at,
    lastError: row.last_error,
    createdAt: row.created_at,
  };
}

/** Map a camelCase status patch to the snake_case keys PostgREST expects. */
function toSnakePatch(patch: SourceStatusPatch): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (patch.etag !== undefined) payload.etag = patch.etag;
  if (patch.lastModified !== undefined) {
    payload.last_modified = patch.lastModified;
  }
  if (patch.lastFetchedAt !== undefined) {
    payload.last_fetched_at = patch.lastFetchedAt;
  }
  if (patch.lastSuccessAt !== undefined) {
    payload.last_success_at = patch.lastSuccessAt;
  }
  if (patch.lastError !== undefined) payload.last_error = patch.lastError;
  return payload;
}

/**
 * Environment variables {@link createIngestDb} reads. The index signature
 * lets callers pass `process.env` (or a partial object in tests).
 */
export interface IngestDbEnv {
  /** Public project URL (safe to expose, hence the NEXT_PUBLIC_ name). */
  NEXT_PUBLIC_SUPABASE_URL?: string;
  /** Service-role key — server-side only, never a NEXT_PUBLIC_ variable. */
  SUPABASE_SERVICE_ROLE_KEY?: string;
  [key: string]: string | undefined;
}

/**
 * Create the ingestion database adapter from environment variables.
 *
 * Reads `NEXT_PUBLIC_SUPABASE_URL` (public project URL) and
 * `SUPABASE_SERVICE_ROLE_KEY` (server-side only — never a `NEXT_PUBLIC_`
 * variable). Throws immediately if either is missing, so a misconfigured
 * run fails before fetching any feeds.
 */
export function createIngestDb(env: IngestDbEnv = process.env): IngestDb {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  const missing = [
    ...(url ? [] : ["NEXT_PUBLIC_SUPABASE_URL"]),
    ...(serviceRoleKey ? [] : ["SUPABASE_SERVICE_ROLE_KEY"]),
  ];
  if (missing.length > 0) {
    throw new Error(
      `missing environment variables: ${missing.join(", ")} (see .env.example)`,
    );
  }

  const client: SupabaseClient = createClient(
    url as string,
    serviceRoleKey as string,
  );

  return {
    async listActiveSources() {
      const { data, error } = await client
        .from("sources")
        .select(SOURCE_COLUMNS)
        .eq("is_active", true)
        .order("name");
      if (error) {
        throw new Error(`loading active sources failed: ${error.message}`);
      }
      return (data as RawSourceRow[]).map(toSource);
    },

    async listUnembeddedItems() {
      const pageSize = 1000;
      const items: UnembeddedItem[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await client
          .from("content_items")
          .select("id,title,summary")
          .is("embedding", null)
          .order("created_at")
          .range(offset, offset + pageSize - 1);
        if (error) {
          throw new Error(
            `loading unembedded content items failed: ${error.message}`,
          );
        }
        const page = data as UnembeddedItem[];
        items.push(...page);
        if (page.length < pageSize) return items;
      }
    },

    async saveEmbedding(id, embedding, model) {
      const vector = `[${embedding.join(",")}]`;
      const { data, error } = await client
        .from("content_items")
        .update({ embedding: vector, embedding_model: model })
        .eq("id", id)
        .is("embedding", null)
        .select("id");
      if (error) {
        throw new Error(
          `saving embedding for content item ${id} failed: ${error.message}`,
        );
      }
      return (data?.length ?? 0) > 0;
    },

    async insertItems(source, items) {
      const rows = toContentItemRows(source, items);
      if (rows.length === 0) return 0;

      // Upsert with `ignoreDuplicates` is an `insert … on conflict (url)
      // do nothing`: PostgREST's RETURNING yields only the actually
      // inserted rows, so the count is the number of new items.
      const { data, error } = await client
        .from("content_items")
        .upsert(rows, { onConflict: "url", ignoreDuplicates: true })
        .select("id");
      if (error) {
        throw new Error(`inserting content items failed: ${error.message}`);
      }
      return data?.length ?? 0;
    },

    async updateSource(id, patch) {
      const payload = toSnakePatch(patch);
      if (Object.keys(payload).length === 0) return;
      const { error } = await client
        .from("sources")
        .update(payload)
        .eq("id", id);
      if (error) {
        throw new Error(`updating source ${id} failed: ${error.message}`);
      }
    },
  };
}
