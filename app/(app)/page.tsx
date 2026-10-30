import { redirect } from "next/navigation";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";
import FeedList from "@/app/feed/feed-list";
import { RefreshFeedButton } from "@/app/feed/refresh-feed-button";
import type { FeedItem } from "@/lib/feed-ui";

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
  const params = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      {params.error === "sign-out" && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>Sign-out failed. Please try again.</AlertTitle>
        </Alert>
      )}
      <section className="flex flex-col gap-4" aria-labelledby="feed-heading">
        <div className="flex items-center justify-between gap-4">
          <h1
            id="feed-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Your feed
          </h1>
          <RefreshFeedButton />
        </div>
        {feedError ? (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>
              The feed could not be loaded. Please try again.
            </AlertTitle>
          </Alert>
        ) : (
          <FeedList
            key={renderedAt}
            initialItems={feedItems}
            renderedAt={renderedAt}
          />
        )}
      </section>
    </main>
  );
}
