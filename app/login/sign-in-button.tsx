"use client";

import { useState } from "react";
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
    <div>
      <button
        className="button"
        type="button"
        onClick={signIn}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Connecting to Google..." : "Sign in with Google"}
      </button>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
