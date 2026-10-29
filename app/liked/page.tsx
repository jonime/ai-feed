import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import type { LikedFeedItem } from "../../lib/feed-ui";
import { signOut } from "../auth/actions";
import LikedList from "./liked-list";

export const instant = false;

interface RelatedContentItem {
  id: string;
  url: string;
  title: string;
  summary: string | null;
  type: "article" | "video";
  language: "fi" | "en";
  thumbnail_url: string | null;
  published_at: string;
  source: { name: string } | { name: string }[] | null;
}

interface RawLikedItem {
  updated_at: string;
  item: RelatedContentItem | RelatedContentItem[] | null;
}

export default async function LikedPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) redirect("/login");

  const { data, error } = await supabase
    .from("feedback")
    .select(
      "updated_at,item:content_items(id,url,title,summary,type,language,thumbnail_url,published_at,source:sources(name))",
    )
    .eq("kind", "like")
    .order("updated_at", { ascending: false });
  const likedItems = ((data ?? []) as RawLikedItem[]).flatMap((row) => {
    const item = Array.isArray(row.item) ? row.item[0] : row.item;
    if (!item) return [];
    const source = Array.isArray(item.source) ? item.source[0] : item.source;
    const likedItem: LikedFeedItem = {
      id: item.id,
      url: item.url,
      title: item.title,
      summary: item.summary,
      type: item.type,
      language: item.language,
      thumbnail_url: item.thumbnail_url,
      published_at: item.published_at,
      source_name: source?.name ?? "Unknown source",
      liked_at: row.updated_at,
    };
    return [likedItem];
  });

  const email =
    typeof claimsData.claims.email === "string"
      ? claimsData.claims.email
      : "Signed in";
  const renderedAt = new Date().toISOString();

  return (
    <main className="app-shell">
      <header className="account-header">
        <div>
          <h1>AI Feed</h1>
          <p className="account-email">{email}</p>
          <nav className="account-nav" aria-label="Main navigation">
            <Link href="/">Feed</Link>
            <span aria-current="page">Liked</span>
          </nav>
        </div>
        <form action={signOut}>
          <button className="button button-secondary" type="submit">
            Sign out
          </button>
        </form>
      </header>
      <section className="feed-section" aria-labelledby="liked-heading">
        <h2 id="liked-heading" className="liked-heading">
          Liked items
        </h2>
        {error ? (
          <p className="auth-error" role="alert">
            Liked items could not be loaded. Please try again.
          </p>
        ) : (
          <LikedList initialItems={likedItems} renderedAt={renderedAt} />
        )}
      </section>
    </main>
  );
}
