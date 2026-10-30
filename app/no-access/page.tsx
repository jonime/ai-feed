import { redirect } from "next/navigation";
import { LogOutIcon, ShieldAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/auth/actions";
import { getAppAccessRedirect } from "@/lib/app-access";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function NoAccessPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const isVerifiedUser = !error && typeof data?.claims?.sub === "string";
  let isAllowed = false;

  if (isVerifiedUser) {
    const result = await supabase.rpc("is_allowed");
    if (result.error) throw new Error("Could not verify feed access");
    isAllowed = result.data === true;
  }

  const redirectTo = getAppAccessRedirect(isVerifiedUser, isAllowed);
  if (redirectTo === "/login") redirect("/login");
  if (redirectTo === null) redirect("/");

  return (
    <main className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-2xl flex-col justify-center gap-6 px-4 py-10">
      <section className="flex flex-col gap-4">
        <ShieldAlertIcon
          className="size-8 text-muted-foreground"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            This account does not have feed access
          </h1>
          <p className="max-w-prose text-muted-foreground">
            Access is invite-only. Contact the person who invited you if you
            think this account should be allowed.
          </p>
        </div>
      </section>
      <form action={signOut}>
        <Button type="submit">
          <LogOutIcon data-icon="inline-start" aria-hidden="true" />
          Sign out
        </Button>
      </form>
    </main>
  );
}
