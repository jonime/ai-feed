/**
 * RLS integration tests for spec 001, task 9.
 *
 * These run against a real Supabase project with migrations applied and are
 * skipped by default. For local verification:
 *
 *   supabase start
 *   supabase db reset
 *   SUPABASE_INTEGRATION=1 \
 *     SUPABASE_URL=http://127.0.0.1:55321 \
 *     NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key printed by `supabase status`> \
 *     SUPABASE_SERVICE_ROLE_KEY=<service key printed by `supabase status`> \
 *     pnpm test lib/rls.integration.test.ts
 *
 * The test creates a throwaway user and fixture rows, then removes them.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const enabled = process.env.SUPABASE_INTEGRATION === "1";
const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:55321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!enabled || anonKey == null || serviceKey == null)(
  "row-level security against a real database",
  () => {
    const options = {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    };
    const anonymousClient: SupabaseClient | null = anonKey
      ? createClient(url, anonKey, options)
      : null;
    const serviceClient: SupabaseClient | null = serviceKey
      ? createClient(url, serviceKey, options)
      : null;
    const authenticatedClient: SupabaseClient | null = anonKey
      ? createClient(url, anonKey, options)
      : null;

    function ready(): {
      anonymous: SupabaseClient;
      authenticated: SupabaseClient;
      service: SupabaseClient;
    } {
      if (
        anonymousClient == null ||
        authenticatedClient == null ||
        serviceClient == null
      ) {
        throw new Error("integration environment not ready");
      }
      return {
        anonymous: anonymousClient,
        authenticated: authenticatedClient,
        service: serviceClient,
      };
    }

    const testId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const email = `rls-${testId}@example.test`;
    const password = `Rls-test-${testId}-Aa1!`;
    const feedUrl = `https://rls-integration.example/${testId}/feed`;
    const itemUrl = `https://rls-integration.example/${testId}/item`;
    let sourceId: string;
    let itemId: string;
    let userId: string;

    beforeAll(async () => {
      const { service, authenticated } = ready();
      const { data: userData, error: userError } =
        await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
      if (userError) {
        throw new Error(`creating RLS test user failed: ${userError.message}`);
      }
      userId = userData.user.id;

      const { error: signInError } =
        await authenticated.auth.signInWithPassword({ email, password });
      if (signInError) {
        throw new Error(
          `signing in RLS test user failed: ${signInError.message}`,
        );
      }

      const { data: source, error: sourceError } = await service
        .from("sources")
        .insert({
          name: "RLS integration test",
          feed_url: feedUrl,
          kind: "rss",
          language: "en",
          is_active: true,
        })
        .select("id")
        .single();
      if (sourceError) {
        throw new Error(
          `creating RLS test source failed: ${sourceError.message}`,
        );
      }
      sourceId = source.id as string;

      const { data: item, error: itemError } = await service
        .from("content_items")
        .insert({
          source_id: sourceId,
          type: "article",
          url: itemUrl,
          title: "RLS integration test item",
          language: "en",
          published_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (itemError) {
        throw new Error(`creating RLS test item failed: ${itemError.message}`);
      }
      itemId = item.id as string;
    });

    afterAll(async () => {
      const { service } = ready();
      await service.from("content_items").delete().eq("id", itemId);
      await service.from("sources").delete().eq("id", sourceId);
      if (userId != null) {
        await service.auth.admin.deleteUser(userId);
      }
    });

    it("allows an authenticated user to select both shared tables", async () => {
      const { authenticated } = ready();
      const { data: source, error: sourceError } = await authenticated
        .from("sources")
        .select("id")
        .eq("id", sourceId)
        .single();
      const { data: item, error: itemError } = await authenticated
        .from("content_items")
        .select("id")
        .eq("id", itemId)
        .single();

      expect(sourceError).toBeNull();
      expect(source?.id).toBe(sourceId);
      expect(itemError).toBeNull();
      expect(item?.id).toBe(itemId);
    });

    it("denies anonymous reads from both shared tables", async () => {
      const { anonymous } = ready();
      const { error: sourceError } = await anonymous
        .from("sources")
        .select("id")
        .eq("id", sourceId);
      const { error: itemError } = await anonymous
        .from("content_items")
        .select("id")
        .eq("id", itemId);

      expect(sourceError?.code).toBe("42501");
      expect(itemError?.code).toBe("42501");
    });

    it("denies authenticated inserts to both shared tables", async () => {
      const { authenticated } = ready();
      const { error: sourceError } = await authenticated
        .from("sources")
        .insert({
          name: "Forbidden source",
          feed_url: `${feedUrl}/forbidden`,
          kind: "rss",
          language: "en",
        });
      const { error: itemError } = await authenticated
        .from("content_items")
        .insert({
          source_id: sourceId,
          type: "article",
          url: `${itemUrl}/forbidden`,
          title: "Forbidden item",
          language: "en",
          published_at: new Date().toISOString(),
        });

      expect(sourceError?.code).toBe("42501");
      expect(itemError?.code).toBe("42501");
    });

    it("denies authenticated updates to both shared tables", async () => {
      const { authenticated } = ready();
      const { error: sourceError } = await authenticated
        .from("sources")
        .update({ name: "Changed by authenticated user" })
        .eq("id", sourceId);
      const { error: itemError } = await authenticated
        .from("content_items")
        .update({ title: "Changed by authenticated user" })
        .eq("id", itemId);

      expect(sourceError?.code).toBe("42501");
      expect(itemError?.code).toBe("42501");
    });

    it("denies authenticated deletes from both shared tables", async () => {
      const { authenticated } = ready();
      const { error: sourceError } = await authenticated
        .from("sources")
        .delete()
        .eq("id", sourceId);
      const { error: itemError } = await authenticated
        .from("content_items")
        .delete()
        .eq("id", itemId);

      expect(sourceError?.code).toBe("42501");
      expect(itemError?.code).toBe("42501");
    });
  },
);
