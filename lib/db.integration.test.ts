/**
 * Integration tests for the ingestion database writes (spec 001, task 6).
 *
 * These run against a real Postgres with the project migrations applied,
 * using the service-role key, and are skipped by default (so `pnpm test`
 * stays hermetic). To run them against the local stack:
 *
 *   supabase start
 *   supabase db reset
 *   SUPABASE_INTEGRATION=1 \
 *     SUPABASE_SERVICE_ROLE_KEY=<local service key printed by `supabase start`> \
 *     pnpm test lib/db.integration.test.ts
 *
 * For the cloud project, also set `SUPABASE_URL` to the project URL. The
 * tests create throwaway rows and clean them up afterwards.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createIngestDb,
  recordSourceOutcome,
  type IngestDb,
  type Source,
} from "./db";
import type { ParsedItem } from "./normalize/parse";

const enabled = process.env.SUPABASE_INTEGRATION === "1";
const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:55321";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!enabled || serviceKey == null)(
  "IngestDb against a real database",
  () => {
    // Built unconditionally: the describe callback runs during collection
    // even when the suite is skipped, and `createClient` throws on a null
    // key. `null` only happens in that skipped case, where no test runs.
    const client: SupabaseClient | null = serviceKey
      ? createClient(url, serviceKey)
      : null;
    const db: IngestDb | null =
      client != null
        ? createIngestDb({
            NEXT_PUBLIC_SUPABASE_URL: url,
            SUPABASE_SERVICE_ROLE_KEY: serviceKey,
          })
        : null;

    /** Narrows the nullable handles; tests only run when ready. */
    function ready(): { client: SupabaseClient; db: IngestDb } {
      if (client == null || db == null) {
        throw new Error("integration environment not ready");
      }
      return { client, db };
    }

    /** Unique per run, so the tests never collide with real content. */
    const prefix = `https://poimio-integration.example/${Date.now()}`;
    let sourceA: Source;
    let sourceB: Source;

    function item(urlValue: string, title: string): ParsedItem {
      return {
        url: urlValue,
        title,
        summary: "Integration test summary",
        type: "article",
        categories: ["Test"],
        thumbnailUrl: null,
        publishedAt: new Date("2026-10-28T08:00:00.000Z"),
      };
    }

    async function makeSource(name: string, feedUrl: string): Promise<Source> {
      const { client } = ready();
      const { data, error } = await client
        .from("sources")
        .insert({
          name,
          feed_url: feedUrl,
          kind: "rss",
          language: "en",
          is_active: true,
        })
        .select()
        .single();
      if (error) {
        throw new Error(`creating test source failed: ${error.message}`);
      }
      return {
        id: data.id as string,
        name: data.name as string,
        feedUrl: data.feed_url as string,
        siteUrl: null,
        kind: "rss",
        language: "en",
        isActive: true,
        etag: null,
        lastModified: null,
        lastFetchedAt: null,
        lastSuccessAt: null,
        lastError: null,
        createdAt: data.created_at as string,
      };
    }

    beforeAll(async () => {
      sourceA = await makeSource("Integration test A", `${prefix}/feed-a`);
      sourceB = await makeSource("Integration test B", `${prefix}/feed-b`);
    });

    afterAll(async () => {
      const { client } = ready();
      await client
        .from("content_items")
        .delete()
        .in("source_id", [sourceA.id, sourceB.id]);
      await client.from("sources").delete().in("id", [sourceA.id, sourceB.id]);
    });

    it("lists the seeded active sources", async () => {
      const { db } = ready();
      const sources = await db.listActiveSources();
      expect(sources.length).toBeGreaterThanOrEqual(17);
      const names = sources.map((s) => s.name);
      expect(names).toContain("Yle — Latest News");
      expect(names).toContain("Engineering Explained");
      expect(sources.every((s) => s.isActive)).toBe(true);
    });

    it("inserts items, then reports 0 new on a repeat run (on conflict do nothing)", async () => {
      const { client, db } = ready();
      const items = [
        item(`${prefix}/a`, "Item A"),
        item(`${prefix}/b`, "Item B"),
      ];

      expect(await db.insertItems(sourceA, items)).toBe(2);
      // Re-inserting the same items (unchanged feed) adds nothing.
      expect(await db.insertItems(sourceA, items)).toBe(0);

      const { data, error } = await client
        .from("content_items")
        .select("source_id,url,title,summary,language")
        .in("url", [`${prefix}/a`, `${prefix}/b`]);
      expect(error).toBeNull();
      expect(data).toHaveLength(2);
    });

    it("lets the first source win when two sources deliver the same URL", async () => {
      const { client, db } = ready();
      const shared = item(`${prefix}/shared`, "Shared item");

      expect(await db.insertItems(sourceA, [shared])).toBe(1);
      expect(await db.insertItems(sourceB, [shared])).toBe(0);

      const { data, error } = await client
        .from("content_items")
        .select("source_id")
        .eq("url", `${prefix}/shared`)
        .single();
      expect(error).toBeNull();
      expect(data?.source_id).toBe(sourceA.id);
    });

    it("applies source status patches to the right row and fields", async () => {
      const { client, db } = ready();
      const now = new Date();
      await db.updateSource(sourceA.id, {
        etag: "w/abc",
        lastModified: "Wed, 28 Oct 2026 08:00:00 GMT",
        lastFetchedAt: now,
        lastError: "HTTP 404 Not Found",
      });

      const { data, error } = await client
        .from("sources")
        .select("etag,last_modified,last_fetched_at,last_success_at,last_error")
        .eq("id", sourceA.id)
        .single();
      expect(error).toBeNull();
      expect(data?.etag).toBe("w/abc");
      expect(data?.last_modified).toBe("Wed, 28 Oct 2026 08:00:00 GMT");
      expect(
        Math.abs(Date.parse(data?.last_fetched_at ?? "") - now.getTime()),
      ).toBeLessThan(5000);
      expect(data?.last_success_at).toBeNull();
      expect(data?.last_error).toBe("HTTP 404 Not Found");
    });

    it("recordSourceOutcome: a parse failure clears the conditional-GET state", async () => {
      const { client, db } = ready();
      // Seed some conditional-GET state first.
      await client
        .from("sources")
        .update({
          etag: "w/old",
          last_modified: "Tue, 27 Oct 2026 08:00:00 GMT",
        })
        .eq("id", sourceB.id);

      const now = new Date();
      await recordSourceOutcome(
        db,
        sourceB.id,
        { kind: "error", phase: "parse", error: "unsupported feed format" },
        now,
      );

      const { data, error } = await client
        .from("sources")
        .select("etag,last_modified,last_error,last_success_at")
        .eq("id", sourceB.id)
        .single();
      expect(error).toBeNull();
      expect(data?.etag).toBeNull();
      expect(data?.last_modified).toBeNull();
      expect(data?.last_error).toBe("unsupported feed format");
      expect(data?.last_success_at).toBeNull();
    });

    it("a successful fetch records success and the new conditional-GET headers", async () => {
      const { client, db } = ready();
      const now = new Date();
      await recordSourceOutcome(
        db,
        sourceA.id,
        {
          kind: "fetched",
          newItems: 2,
          etag: "w/new",
          lastModified: "Wed, 28 Oct 2026 09:00:00 GMT",
        },
        now,
      );

      const { data, error } = await client
        .from("sources")
        .select("etag,last_modified,last_success_at,last_error")
        .eq("id", sourceA.id)
        .single();
      expect(error).toBeNull();
      expect(data?.etag).toBe("w/new");
      expect(data?.last_modified).toBe("Wed, 28 Oct 2026 09:00:00 GMT");
      expect(data?.last_error).toBeNull();
      expect(Date.parse(data?.last_success_at ?? "")).toBeGreaterThan(0);
    });
  },
);
