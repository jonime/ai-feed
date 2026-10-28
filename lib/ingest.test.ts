import { describe, expect, it } from "vitest";
import type { IngestDb, Source, SourceStatusPatch } from "./db";
import type { ParsedItem } from "./normalize/parse";
import {
  formatIngestionSummary,
  runIngestion,
  type IngestionSummary,
} from "./ingest";

const feedXml = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Test</title><link>https://example.com</link>
<description>Test feed</description><item><title>One</title><link>https://example.com/one</link>
<description>Summary</description><pubDate>Tue, 28 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>`;

function source(id: string, name: string): Source {
  return {
    id,
    name,
    feedUrl: `https://example.com/${id}.xml`,
    siteUrl: "https://example.com",
    kind: "rss",
    language: "en",
    isActive: true,
    etag: null,
    lastModified: null,
    lastFetchedAt: null,
    lastSuccessAt: null,
    lastError: null,
    createdAt: "2026-10-28T00:00:00.000Z",
  };
}

class FakeIngestDb implements IngestDb {
  updates: Array<{ id: string; patch: SourceStatusPatch }> = [];
  inserted: ParsedItem[][] = [];

  constructor(readonly sources: Source[]) {}

  async listActiveSources(): Promise<Source[]> {
    return this.sources;
  }

  async listUnembeddedItems() {
    return [];
  }

  async saveEmbedding(): Promise<boolean> {
    return false;
  }

  async insertItems(
    _source: Pick<Source, "id" | "language">,
    items: ParsedItem[],
  ) {
    this.inserted.push(items);
    return items.length;
  }

  async updateSource(id: string, patch: SourceStatusPatch): Promise<void> {
    this.updates.push({ id, patch });
  }
}

describe("runIngestion", () => {
  it("summarizes fetched, unchanged, failed, and malformed sources independently", async () => {
    const sources = [
      source("fresh", "Fresh"),
      source("unchanged", "Unchanged"),
      source("failed", "Failed"),
      source("malformed", "Malformed"),
    ];
    const db = new FakeIngestDb(sources);
    const result = await runIngestion(db, "test-key", {
      fetchBatch: async () => [
        {
          status: "ok",
          body: feedXml,
          contentType: "application/rss+xml",
          etag: "tag-1",
        },
        { status: "not_modified" },
        { status: "error", error: "HTTP 404 Not Found" },
        {
          status: "ok",
          body: "<html>not a feed</html>",
          contentType: "text/html",
        },
      ],
      now: () => new Date("2026-10-28T12:00:00.000Z"),
    });

    expect(result.sources).toEqual([
      { name: "Fresh", fetched: 1, newItems: 1, skipped: 0, errors: [] },
      { name: "Unchanged", fetched: 0, newItems: 0, skipped: 1, errors: [] },
      {
        name: "Failed",
        fetched: 0,
        newItems: 0,
        skipped: 0,
        errors: ["HTTP 404 Not Found"],
      },
      {
        name: "Malformed",
        fetched: 1,
        newItems: 0,
        skipped: 0,
        errors: ["unsupported feed format: expected RSS 2.0 or Atom"],
      },
    ]);
    expect(db.inserted).toHaveLength(1);
    expect(db.updates.map(({ id }) => id)).toEqual([
      "fresh",
      "unchanged",
      "failed",
      "malformed",
    ]);
    expect(result.embeddings).toEqual({ embedded: 0, failedBatches: [] });
  });
});

describe("formatIngestionSummary", () => {
  it("prints per-source counts and embedding batch failures", () => {
    const summary: IngestionSummary = {
      sources: [
        { name: "Feed A", fetched: 1, newItems: 2, skipped: 0, errors: [] },
        {
          name: "Feed B",
          fetched: 0,
          newItems: 0,
          skipped: 0,
          errors: ["HTTP 503"],
        },
      ],
      embeddings: {
        embedded: 2,
        failedBatches: [{ itemIds: ["item-3"], error: "temporary failure" }],
      },
    };

    expect(formatIngestionSummary(summary)).toBe(
      [
        "Ingestion summary",
        "Source | fetched | new | skipped | errors",
        "Feed A | 1 | 2 | 0 | 0",
        "Feed B | 0 | 0 | 0 | 1 (HTTP 503)",
        "Embedded: 2",
        "Embedding error (1 items): temporary failure",
      ].join("\n"),
    );
  });
});
