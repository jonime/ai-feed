import { CircleAlertIcon } from "lucide-react";
import Image from "next/image";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isLocalPasswordLoginEnabled } from "../../lib/supabase/local-password-login";
import { LocalSignInDialog } from "./local-sign-in-dialog";
import { SignInButton } from "./sign-in-button";

export const instant = false;

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Image
          src="/full.png"
          alt="Poimio"
          width={2172}
          height={724}
          priority
          className="mx-auto h-auto w-full max-w-56"
        />
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              <h1 id="login-heading">Sign in</h1>
            </CardTitle>
            <CardDescription>
              Your personal feed of Finnish and English news, articles, and
              videos.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {params.error === "callback" && (
              <Alert variant="destructive">
                <CircleAlertIcon aria-hidden="true" />
                <AlertTitle>
                  Sign-in could not be completed. Please try again.
                </AlertTitle>
              </Alert>
            )}
            <SignInButton />
          </CardContent>
        </Card>
      </div>
      {isLocalPasswordLoginEnabled() && <LocalSignInDialog />}
    </main>
  );
}
