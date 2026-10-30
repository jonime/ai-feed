import { createClient } from "@supabase/supabase-js";
import {
  getAllowlistTarget,
  parseAllowlistArgs,
} from "../lib/allowlist-cli.ts";

async function main(): Promise<void> {
  const args = parseAllowlistArgs(process.argv.slice(2));
  process.loadEnvFile(args.envFile);

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!projectUrl || !serviceRoleKey) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in ${args.envFile}`,
    );
  }

  const target = getAllowlistTarget(
    projectUrl,
    args.envFile,
    args.envFileExplicit,
  );
  console.log(`Supabase target: ${target.host}`);

  const client = createClient(projectUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  if (args.command === "add") {
    const { data: existing, error: lookupError } = await client
      .from("allowed_users")
      .select("email")
      .eq("email", args.email)
      .maybeSingle();
    if (lookupError)
      throw new Error(`checking allowlist failed: ${lookupError.message}`);

    if (existing) {
      if (args.note !== undefined) {
        const { error } = await client
          .from("allowed_users")
          .update({ note: args.note })
          .eq("email", args.email);
        if (error)
          throw new Error(`updating allowlist entry failed: ${error.message}`);
      }
      console.log(`Already allowed: ${args.email}`);
      return;
    }

    const { error } = await client.from("allowed_users").insert({
      email: args.email,
      note: args.note ?? null,
    });
    if (error)
      throw new Error(`adding allowlist entry failed: ${error.message}`);
    console.log(`Added: ${args.email}`);
    return;
  }

  if (args.command === "remove") {
    const { data, error } = await client
      .from("allowed_users")
      .delete()
      .eq("email", args.email)
      .select("email");
    if (error)
      throw new Error(`removing allowlist entry failed: ${error.message}`);
    console.log(
      data.length > 0 ? `Removed: ${args.email}` : `Not found: ${args.email}`,
    );
    return;
  }

  const { data, error } = await client
    .from("allowed_users")
    .select("email,note,added_at")
    .order("email");
  if (error) throw new Error(`listing allowlist failed: ${error.message}`);
  if (data.length === 0) {
    console.log("No allowed users.");
    return;
  }
  console.log("Email | Added at | Note");
  for (const user of data) {
    console.log(`${user.email} | ${user.added_at} | ${user.note ?? ""}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
