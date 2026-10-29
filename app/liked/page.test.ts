import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LikedPage from "./page";

const { auth, createClient, from, select, eq, order } = vi.hoisted(() => ({
  auth: { getClaims: vi.fn() },
  createClient: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));

vi.mock("../../lib/supabase/server", () => ({ createClient }));
vi.mock("next/navigation", () => ({
  redirect: (destination: string): never => {
    throw new Error(`REDIRECT:${destination}`);
  },
}));

const claims = {
  data: { claims: { sub: "user-a", email: "user-a@example.com" } },
  error: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  createClient.mockResolvedValue({ auth, from });
  auth.getClaims.mockResolvedValue(claims);
  from.mockReturnValue({ select });
  select.mockReturnValue({ eq });
  eq.mockReturnValue({ order });
  order.mockResolvedValue({
    data: [
      {
        updated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        item: {
          id: "item-1",
          url: "https://example.com/story",
          title: "A liked article",
          summary: "Short summary",
          type: "article",
          language: "en",
          thumbnail_url: null,
          published_at: "2026-10-29T11:00:00.000Z",
          source: { name: "Example News" },
        },
      },
    ],
    error: null,
  });
});

describe("liked page", () => {
  it("loads only like rows newest-first through the session client", async () => {
    const html = renderToStaticMarkup(await LikedPage());

    expect(auth.getClaims).toHaveBeenCalledExactlyOnceWith();
    expect(from).toHaveBeenCalledExactlyOnceWith("feedback");
    expect(select).toHaveBeenCalledWith(
      expect.stringContaining("content_items"),
    );
    expect(eq).toHaveBeenCalledExactlyOnceWith("kind", "like");
    expect(order).toHaveBeenCalledExactlyOnceWith("updated_at", {
      ascending: false,
    });
    expect(html).toContain("Liked items");
    expect(html).toContain("A liked article");
    expect(html).toContain("Example News");
    expect(html).toContain("Unlike");
    expect(html).toContain("Feed");
  });

  it.each([
    { data: null, error: null },
    { data: { claims: {} }, error: null },
    { ...claims, error: new Error("Unverified claims") },
  ])("redirects when the user is missing or unverified", async (result) => {
    auth.getClaims.mockResolvedValueOnce(result);
    await expect(LikedPage()).rejects.toThrow("REDIRECT:/login");
    expect(from).not.toHaveBeenCalled();
  });
});
