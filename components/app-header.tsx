import Link from "next/link";
import { LogOutIcon, RssIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "../app/auth/actions";

const navItems = [
  { href: "/", label: "Feed" },
  { href: "/liked", label: "Liked" },
] as const;

export function AppHeader({
  email,
  current,
}: {
  email: string;
  current: (typeof navItems)[number]["href"];
}) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-medium">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <RssIcon className="size-4" aria-hidden="true" />
          </span>
          <span className="hidden sm:inline">AI Feed</span>
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main navigation">
          {navItems.map((item) => (
            <Button
              key={item.href}
              variant={item.href === current ? "secondary" : "ghost"}
              nativeButton={false}
              render={
                <Link
                  href={item.href}
                  aria-current={item.href === current ? "page" : undefined}
                />
              }
            >
              {item.label}
            </Button>
          ))}
        </nav>
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
