import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";
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

  const email =
    typeof data.claims.email === "string" ? data.claims.email : "Signed in";
  const params = await searchParams;

  return (
    <main className="app-shell">
      <header className="account-header">
        <div>
          <h1>AI Feed</h1>
          <p className="account-email">{email}</p>
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
    </main>
  );
}
