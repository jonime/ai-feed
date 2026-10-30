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
    const authenticatedClientB: SupabaseClient | null = anonKey
      ? createClient(url, anonKey, options)
      : null;
    const unallowedClient: SupabaseClient | null = anonKey
      ? createClient(url, anonKey, options)
      : null;

    function ready(): {
      anonymous: SupabaseClient;
      authenticated: SupabaseClient;
      authenticatedB: SupabaseClient;
      unallowed: SupabaseClient;
      service: SupabaseClient;
    } {
      if (
        anonymousClient == null ||
        authenticatedClient == null ||
        authenticatedClientB == null ||
        unallowedClient == null ||
        serviceClient == null
      ) {
        throw new Error("integration environment not ready");
      }
      return {
        anonymous: anonymousClient,
        authenticated: authenticatedClient,
        authenticatedB: authenticatedClientB,
        unallowed: unallowedClient,
        service: serviceClient,
      };
    }

    const testId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const email = `rls-${testId}@example.test`;
    const emailB = `rls-b-${testId}@example.test`;
    const unallowedEmail = `rls-unallowed-${testId}@example.test`;
    const password = `Rls-test-${testId}-Aa1!`;
    const feedUrl = `https://rls-integration.example/${testId}/feed`;
    const itemUrl = `https://rls-integration.example/${testId}/item`;
    const meansModel = `rls-test-${testId}`;
    let sourceId: string;
    let itemId: string;
    let userId: string;
    let userBId: string;
    let unallowedUserId: string;

    beforeAll(async () => {
      const { service, authenticated, authenticatedB, unallowed } = ready();
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

      const userB = await service.auth.admin.createUser({
        email: emailB,
        password,
        email_confirm: true,
      });
      if (userB.error) {
        throw new Error(
          `creating RLS test user B failed: ${userB.error.message}`,
        );
      }
      userBId = userB.data.user.id;

      const unallowedUser = await service.auth.admin.createUser({
        email: unallowedEmail,
        password,
        email_confirm: true,
      });
      if (unallowedUser.error) {
        throw new Error(
          `creating unallowed RLS test user failed: ${unallowedUser.error.message}`,
        );
      }
      unallowedUserId = unallowedUser.data.user.id;

      const { error: allowlistError } = await service
        .from("allowed_users")
        .insert([{ email }, { email: emailB }]);
      if (allowlistError) {
        throw new Error(
          `allowlisting RLS test users failed: ${allowlistError.message}`,
        );
      }

      const [signIn, signInB, signInUnallowed] = await Promise.all([
        authenticated.auth.signInWithPassword({ email, password }),
        authenticatedB.auth.signInWithPassword({ email: emailB, password }),
        unallowed.auth.signInWithPassword({ email: unallowedEmail, password }),
      ]);
      if (signIn.error) {
        throw new Error(
          `signing in RLS test user failed: ${signIn.error.message}`,
        );
      }
      if (signInB.error) {
        throw new Error(
          `signing in RLS test user B failed: ${signInB.error.message}`,
        );
      }
      if (signInUnallowed.error) {
        throw new Error(
          `signing in unallowed RLS test user failed: ${signInUnallowed.error.message}`,
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

      const { error: meansError } = await service
        .from("embedding_language_means")
        .insert({
          embedding_model: meansModel,
          language: "en",
          mean: `[${new Array<number>(512).fill(0).join(",")}]`,
          item_count: 50,
        });
      if (meansError) {
        throw new Error(
          `creating RLS test language mean failed: ${meansError.message}`,
        );
      }

      const { error: feedbackError } = await service.from("feedback").insert({
        user_id: unallowedUserId,
        item_id: itemId,
        kind: "like",
        via: "button",
      });
      if (feedbackError) {
        throw new Error(
          `creating unallowed feedback fixture failed: ${feedbackError.message}`,
        );
      }
    });

    afterAll(async () => {
      const { service } = ready();
      await service
        .from("allowed_users")
        .delete()
        .in("email", [email, emailB, unallowedEmail]);
      await service
        .from("embedding_language_means")
        .delete()
        .eq("embedding_model", meansModel);
      await service.from("feedback").delete().eq("item_id", itemId);
      await service.from("content_items").delete().eq("id", itemId);
      await service.from("sources").delete().eq("id", sourceId);
      for (const id of [userId, userBId, unallowedUserId]) {
        if (id != null) await service.auth.admin.deleteUser(id);
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

    it("limits allowlist reads to each user's own email and denies anonymous access", async () => {
      const { anonymous, authenticated, authenticatedB } = ready();
      const [userAResult, userBResult, anonymousResult] = await Promise.all([
        authenticated.from("allowed_users").select("email"),
        authenticatedB.from("allowed_users").select("email"),
        anonymous.from("allowed_users").select("email"),
      ]);

      expect(userAResult.error).toBeNull();
      expect(userAResult.data).toEqual([{ email }]);
      expect(userBResult.error).toBeNull();
      expect(userBResult.data).toEqual([{ email: emailB }]);
      expect(anonymousResult.error?.code).toBe("42501");
      expect(anonymousResult.data ?? []).toEqual([]);
    });

    it("denies an authenticated user who is not on the allowlist", async () => {
      const { unallowed } = ready();
      const [sources, items, means, feedback, ownAllowlistRow] =
        await Promise.all([
          unallowed.from("sources").select("id").eq("id", sourceId),
          unallowed.from("content_items").select("id").eq("id", itemId),
          unallowed
            .from("embedding_language_means")
            .select("embedding_model")
            .eq("embedding_model", meansModel),
          unallowed
            .from("feedback")
            .select("item_id")
            .eq("user_id", unallowedUserId)
            .eq("item_id", itemId),
          unallowed.from("allowed_users").select("email"),
        ]);

      for (const result of [sources, items, means, feedback, ownAllowlistRow]) {
        expect(result.error).toBeNull();
        expect(result.data).toEqual([]);
      }

      const { error: insertError } = await unallowed.from("feedback").insert({
        item_id: itemId,
        kind: "like",
        via: "button",
      });
      expect(insertError?.code).toBe("42501");

      const { error: feedError } = await unallowed.rpc("get_feed", {
        p_limit: 1,
      });
      expect(feedError?.code).toBe("42501");
      expect(feedError?.message).toContain("User is not allowed");

      const { error: feedbackRpcError } = await unallowed.rpc("set_feedback", {
        p_item_id: itemId,
        p_kind: "like",
        p_via: "button",
      });
      expect(feedbackRpcError?.code).toBe("42501");
      expect(feedbackRpcError?.message).toContain("User is not allowed");
    });

    it("revokes access immediately when an allowlist row is removed", async () => {
      const { authenticated, service } = ready();
      const { data: beforeRemoval, error: beforeError } = await authenticated
        .from("sources")
        .select("id")
        .eq("id", sourceId);
      expect(beforeError).toBeNull();
      expect(beforeRemoval).toEqual([{ id: sourceId }]);

      const { error: removeError } = await service
        .from("allowed_users")
        .delete()
        .eq("email", email);
      expect(removeError).toBeNull();

      try {
        const [sources, feed] = await Promise.all([
          authenticated.from("sources").select("id").eq("id", sourceId),
          authenticated.rpc("get_feed", { p_limit: 1 }),
        ]);
        expect(sources.error).toBeNull();
        expect(sources.data).toEqual([]);
        expect(feed.error?.code).toBe("42501");
        expect(feed.error?.message).toContain("User is not allowed");
      } finally {
        const { error: restoreError } = await service
          .from("allowed_users")
          .insert({ email });
        if (restoreError) {
          throw new Error(
            `restoring RLS test allowlist row failed: ${restoreError.message}`,
          );
        }
      }
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
