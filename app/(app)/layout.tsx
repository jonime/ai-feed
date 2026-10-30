import { Suspense, type ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";

async function UserEmail() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;
  return typeof email === "string" ? email : null;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader
        email={
          <Suspense fallback={null}>
            <UserEmail />
          </Suspense>
        }
      />
      {children}
    </>
  );
}
