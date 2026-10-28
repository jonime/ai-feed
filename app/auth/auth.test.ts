import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "../page";
import Login from "../login/page";
import { signOut } from "./actions";
import { GET } from "./callback/route";

const { auth, createClient } = vi.hoisted(() => ({
  auth: {
    getClaims: vi.fn(),
    signOut: vi.fn(),
    exchangeCodeForSession: vi.fn(),
  },
  createClient: vi.fn(),
}));

vi.mock("../../lib/supabase/server", () => ({ createClient }));
vi.mock("next/navigation", () => ({
  redirect: (destination: string): never => {
    throw new Error(`REDIRECT:${destination}`);
  },
}));

const verifiedClaims = {
  data: { claims: { sub: "user-a", email: "user-a@example.com" } },
  error: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  createClient.mockResolvedValue({ auth });
  auth.getClaims.mockResolvedValue(verifiedClaims);
  auth.signOut.mockResolvedValue({ error: null });
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
});

describe("signed-in page", () => {
  it("independently verifies identity before displaying email and sign-out", async () => {
    const html = renderToStaticMarkup(
      await Home({ searchParams: Promise.resolve({}) }),
    );
    expect(auth.getClaims).toHaveBeenCalledExactlyOnceWith();
    expect(html).toContain("user-a@example.com");
    expect(html).toContain("Sign out");
  });

  it.each([
    { data: null, error: null },
    { data: { claims: {} }, error: null },
    { ...verifiedClaims, error: new Error("Unverified claims") },
  ])(
    "rejects missing or unverified identity independently of proxy",
    async (result) => {
      auth.getClaims.mockResolvedValueOnce(result);
      await expect(Home({ searchParams: Promise.resolve({}) })).rejects.toThrow(
        "REDIRECT:/login",
      );
    },
  );

  it("shows a retry message when sign-out fails", async () => {
    const html = renderToStaticMarkup(
      await Home({ searchParams: Promise.resolve({ error: "sign-out" }) }),
    );
    expect(html).toContain("Sign-out failed. Please try again.");
  });
});

describe("login page", () => {
  it("offers Google as the only sign-in method", async () => {
    const html = renderToStaticMarkup(
      await Login({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain("Sign in with Google");
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).not.toContain('type="password"');
  });

  it("displays a generic callback error rather than provider details", async () => {
    const html = renderToStaticMarkup(
      await Login({ searchParams: Promise.resolve({ error: "callback" }) }),
    );
    expect(html).toContain("Sign-in could not be completed. Please try again.");
  });
});

describe("sign-out action", () => {
  it("verifies identity, signs out the current session, then redirects to login", async () => {
    await expect(signOut()).rejects.toThrow("REDIRECT:/login");
    expect(auth.getClaims).toHaveBeenCalledExactlyOnceWith();
    expect(auth.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
    expect(auth.getClaims.mock.invocationCallOrder[0]).toBeLessThan(
      auth.signOut.mock.invocationCallOrder[0],
    );
  });

  it.each([
    { data: null, error: null },
    { data: { claims: {} }, error: null },
    { ...verifiedClaims, error: new Error("Invalid signature") },
  ])(
    "does not mutate auth when identity verification fails",
    async (result) => {
      auth.getClaims.mockResolvedValueOnce(result);
      await expect(signOut()).rejects.toThrow("REDIRECT:/login");
      expect(auth.signOut).not.toHaveBeenCalled();
    },
  );

  it("returns to the signed-in page with a generic error if sign-out fails", async () => {
    auth.signOut.mockResolvedValueOnce({ error: new Error("Provider error") });
    await expect(signOut()).rejects.toThrow("REDIRECT:/?error=sign-out");
  });
});

describe("OAuth callback", () => {
  it("exchanges the code and independently verifies claims before returning home", async () => {
    const response = await GET(
      new Request("http://localhost:3001/auth/callback?code=valid-code"),
    );
    expect(auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith(
      "valid-code",
    );
    expect(auth.getClaims).toHaveBeenCalledExactlyOnceWith();
    expect(
      auth.exchangeCodeForSession.mock.invocationCallOrder[0],
    ).toBeLessThan(auth.getClaims.mock.invocationCallOrder[0]);
    expect(response.headers.get("location")).toBe("http://localhost:3001/");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it.each([
    "",
    "?error=access_denied&error_description=private",
    "?code=code&error=access_denied",
  ])("rejects missing codes and OAuth errors: %s", async (query) => {
    const response = await GET(
      new Request(`http://localhost:3001/auth/callback${query}`),
    );
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/login?error=callback",
    );
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects an invalid or expired exchange without trusting claims", async () => {
    auth.exchangeCodeForSession.mockResolvedValueOnce({
      error: new Error("Expired code"),
    });
    const response = await GET(
      new Request("http://localhost:3001/auth/callback?code=expired"),
    );
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/login?error=callback",
    );
    expect(auth.getClaims).not.toHaveBeenCalled();
  });

  it.each([
    { data: null, error: null },
    { data: { claims: {} }, error: null },
    { ...verifiedClaims, error: new Error("Invalid signature") },
  ])(
    "rejects the callback if the exchanged identity cannot be verified",
    async (result) => {
      auth.getClaims.mockResolvedValueOnce(result);
      const response = await GET(
        new Request("http://localhost:3001/auth/callback?code=code"),
      );
      expect(response.headers.get("location")).toBe(
        "http://localhost:3001/login?error=callback",
      );
    },
  );

  it.each([
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example/",
    "/another-page",
  ])("ignores next redirect target %s and forwarded hosts", async (next) => {
    const url = new URL("http://localhost:3001/auth/callback?code=code");
    url.searchParams.set("next", next);
    const response = await GET(
      new Request(url, { headers: { "x-forwarded-host": "evil.example" } }),
    );
    expect(response.headers.get("location")).toBe("http://localhost:3001/");
  });
});
