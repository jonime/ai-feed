"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "../../lib/supabase/client";

export function SignInButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (!error) return;
    } catch {}
    setError("Google sign-in is unavailable. Please try again.");
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="lg"
        className="w-full"
        type="button"
        onClick={signIn}
        disabled={pending}
        aria-busy={pending}
      >
        {pending && <Spinner data-icon="inline-start" />}
        {pending ? "Connecting to Google..." : "Sign in with Google"}
      </Button>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
