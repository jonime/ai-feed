import { redirect } from "next/navigation";
import { CircleAlertIcon, RefreshCwIcon } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createClient } from "../lib/supabase/server";
import FeedList from "./feed/feed-list";
import type { FeedItem } from "../lib/feed-ui";

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
    <>
      <AppHeader email={email} current="/" />
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
            <form action="/" method="get">
              <Button variant="outline" type="submit">
                <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
                Refresh feed
              </Button>
            </form>
          </div>
          {feedError ? (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden="true" />
              <AlertTitle>
                The feed could not be loaded. Please try again.
              </AlertTitle>
            </Alert>
          ) : (
            <FeedList initialItems={feedItems} renderedAt={renderedAt} />
          )}
        </section>
      </main>
    </>
  );
}
