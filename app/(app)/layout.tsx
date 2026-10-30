import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getAppAccessRedirect } from "@/lib/app-access";
import { createClient } from "@/lib/supabase/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const isVerifiedUser = !error && typeof data?.claims?.sub === "string";

  const redirectTo = getAppAccessRedirect(isVerifiedUser);
  if (redirectTo) redirect(redirectTo);

  const claims = data?.claims;
  const userMetadata = isRecord(claims?.user_metadata)
    ? claims.user_metadata
    : {};
  const displayName = [
    userMetadata.full_name,
    userMetadata.name,
    userMetadata.display_name,
    claims?.name,
  ].find(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );

  return (
    <>
      <AppHeader displayName={displayName} />
      {children}
    </>
  );
}
