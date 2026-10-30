import Link from "next/link";
import type { ReactNode } from "react";
import { LogOutIcon, RssIcon } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/auth/actions";

export function AppHeader({ email }: { email: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-medium">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <RssIcon className="size-4" aria-hidden="true" />
          </span>
          <span className="hidden sm:inline">Poimio</span>
        </Link>
        <AppNav />
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <span className="hidden truncate text-sm text-muted-foreground md:inline">
            {email}
          </span>
          <form action={signOut}>
            <Button variant="ghost" type="submit">
              <LogOutIcon data-icon="inline-start" aria-hidden="true" />
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
