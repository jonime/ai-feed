import { SignInButton } from "./sign-in-button";

export const instant = false;

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-content" aria-labelledby="login-heading">
        <p className="brand-name">AI Feed</p>
        <h1 id="login-heading">Sign in</h1>
        {params.error === "callback" && (
          <p className="auth-error" role="alert">
            Sign-in could not be completed. Please try again.
          </p>
        )}
        <SignInButton />
      </section>
    </main>
  );
}
