import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../lib/supabase/server";
import FeedList from "./feed/feed-list";
import type { FeedItem } from "../lib/feed-ui";
import { signOut } from "./auth/actions";

export const instant = false;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");

  const { data: feedData, error: feedError } = await supabase.rpc("get_feed", {
    p_limit: 30,
  });
  const feedItems = (feedData ?? []) as FeedItem[];
  const renderedAt = new Date().toISOString();

  const email =
    typeof data.claims.email === "string" ? data.claims.email : "Signed in";
  const params = await searchParams;

  return (
    <main className="app-shell">
      <header className="account-header">
        <div>
          <h1>AI Feed</h1>
          <p className="account-email">{email}</p>
          <nav className="account-nav" aria-label="Main navigation">
            <span aria-current="page">Feed</span>
            <Link href="/liked">Liked</Link>
          </nav>
        </div>
        <form action={signOut}>
          <button className="button button-secondary" type="submit">
            Sign out
          </button>
        </form>
      </header>
      {params.error === "sign-out" && (
        <p className="auth-error" role="alert">
          Sign-out failed. Please try again.
        </p>
      )}
      <section className="feed-section" aria-labelledby="feed-heading">
        <div className="feed-heading-row">
          <h2 id="feed-heading">Your feed</h2>
          <form action="/" method="get">
            <button
              className="button button-secondary refresh-button"
              type="submit"
            >
              Refresh feed
            </button>
          </form>
        </div>
        {feedError ? (
          <p className="auth-error" role="alert">
            The feed could not be loaded. Please try again.
          </p>
        ) : (
          <FeedList initialItems={feedItems} renderedAt={renderedAt} />
        )}
      </section>
    </main>
  );
}
