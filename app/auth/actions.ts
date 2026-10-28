"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");

  const { error: signOutError } = await supabase.auth.signOut({
    scope: "local",
  });
  if (signOutError) redirect("/?error=sign-out");

  redirect("/login");
}
