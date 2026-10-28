import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { createClient as createBrowserSupabase } from "./client";
import { createClient as createServerSupabase } from "./server";
import { config, proxy } from "../../proxy";

const { cookieStore, getClaims } = vi.hoisted(() => ({
  cookieStore: { getAll: vi.fn(), set: vi.fn() },
  getClaims: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({ browser: true })),
  createServerClient: vi.fn(() => ({ auth: { getClaims } })),
}));

function serverCookies() {
  const call = vi.mocked(createServerClient).mock.lastCall;
  if (!call) throw new Error("Server client was not created");
  return call[2].cookies;
}

const refreshedCookie = {
  name: "sb-session",
  value: "refreshed-session",
  options: { path: "/", secure: true, sameSite: "lax" as const },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  cookieStore.getAll.mockReturnValue([
    { name: "sb-session", value: "old-session" },
  ]);
  getClaims.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase clients", () => {
  it("creates the browser client with only public configuration", () => {
    createBrowserSupabase();
    expect(createBrowserClient).toHaveBeenCalledWith(
      "http://127.0.0.1:54321",
      "test-anon-key",
    );
  });

  it("creates a server client per request and reads request cookies", async () => {
    await createServerSupabase();
    await createServerSupabase();
    expect(createServerClient).toHaveBeenCalledTimes(2);
    expect(createServerClient).toHaveBeenCalledWith(
      "http://127.0.0.1:54321",
      "test-anon-key",
      expect.any(Object),
    );
    expect(await serverCookies().getAll()).toEqual(cookieStore.getAll());
  });

  it("writes server action and route handler cookies with their options", async () => {
    await createServerSupabase();
    await serverCookies().setAll?.([refreshedCookie], {});
    expect(cookieStore.set).toHaveBeenCalledWith(
      refreshedCookie.name,
      refreshedCookie.value,
      refreshedCookie.options,
    );
  });

  it("tolerates read-only cookies during Server Component rendering", async () => {
    cookieStore.set.mockImplementation(() => {
      throw new Error("Cookies cannot be modified during rendering");
    });
    await createServerSupabase();
    expect(() => serverCookies().setAll?.([refreshedCookie], {})).not.toThrow();
  });
});

describe("session refresh proxy", () => {
  it("verifies claims even when no session exists and continues the request", async () => {
    const response = await proxy(new NextRequest("http://localhost:3001/"));
    expect(getClaims).toHaveBeenCalledExactlyOnceWith();
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.getAll()).toEqual([]);
  });

  it("forwards refreshed cookies downstream and to the browser with cache protection", async () => {
    const request = new NextRequest("http://localhost:3001/", {
      headers: { cookie: "sb-session=old-session; other=preserved" },
    });
    getClaims.mockImplementationOnce(async () => {
      expect(await serverCookies().getAll()).toEqual(request.cookies.getAll());
      await serverCookies().setAll?.([refreshedCookie], {
        "Cache-Control":
          "private, no-cache, no-store, must-revalidate, max-age=0",
        Expires: "0",
        Pragma: "no-cache",
      });
    });

    const response = await proxy(request);

    expect(request.cookies.get("sb-session")?.value).toBe("refreshed-session");
    expect(response.headers.get("x-middleware-request-cookie")).toContain(
      "sb-session=refreshed-session",
    );
    expect(response.headers.get("x-middleware-request-cookie")).toContain(
      "other=preserved",
    );
    expect(response.cookies.get("sb-session")).toMatchObject({
      name: refreshedCookie.name,
      value: refreshedCookie.value,
      ...refreshedCookie.options,
    });
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("expires")).toBe("0");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  it("preserves cookies and cache headers across multiple cookie writes", async () => {
    getClaims.mockImplementationOnce(async () => {
      await serverCookies().setAll?.([refreshedCookie], {
        "Cache-Control": "private, no-store",
      });
      await serverCookies().setAll?.(
        [{ name: "sb-verifier", value: "", options: { path: "/", maxAge: 0 } }],
        {},
      );
    });
    const response = await proxy(new NextRequest("http://localhost:3001/"));
    expect(response.cookies.get("sb-session")?.value).toBe("refreshed-session");
    expect(response.cookies.get("sb-verifier")?.maxAge).toBe(0);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it.each(["/", "/login", "/auth/callback", "/api/example"])(
    "refreshes sessions on application route %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    },
  );

  it.each([
    "/_next/static/chunk.js",
    "/_next/image",
    "/favicon.ico",
    "/image.png",
  ])("excludes static asset %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });
});
