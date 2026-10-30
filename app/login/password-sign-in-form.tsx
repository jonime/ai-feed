"use client";

import { useActionState } from "react";
import { signInWithPassword } from "../auth/actions";

export function PasswordSignInForm() {
  const [error, formAction, pending] = useActionState(signInWithPassword, null);

  return (
    <form className="password-sign-in" action={formAction} aria-busy={pending}>
      <h2>Local sign-in</h2>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        maxLength={254}
        required
      />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        maxLength={4096}
        required
      />
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button button-secondary"
        type="submit"
        disabled={pending}
      >
        {pending ? "Signing in..." : "Sign in with email"}
      </button>
    </form>
  );
}
