export type AllowlistCommand =
  | {
      command: "add";
      email: string;
      note?: string;
      envFile: string;
      envFileExplicit: boolean;
    }
  | {
      command: "remove";
      email: string;
      envFile: string;
      envFileExplicit: boolean;
    }
  | { command: "list"; envFile: string; envFileExplicit: boolean };

const localPartPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
const domainLabelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const [localPart, domain, ...extraParts] = normalized.split("@");
  const domainLabels = domain?.split(".") ?? [];

  if (
    normalized.length > 254 ||
    extraParts.length > 0 ||
    !localPart ||
    localPart.length > 64 ||
    !localPartPattern.test(localPart) ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !domain ||
    domain.length > 253 ||
    domainLabels.length < 2 ||
    domainLabels.some((label) => !domainLabelPattern.test(label))
  ) {
    throw new Error(`Invalid email address: ${email}`);
  }

  return normalized;
}

export function getAllowlistTarget(
  projectUrl: string,
  envFile: string,
  envFileExplicit: boolean,
): URL {
  const target = new URL(projectUrl);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("Supabase URL must use http or https");
  }

  const isLocalTarget = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(
    target.hostname,
  );
  if (
    !isLocalTarget &&
    (!envFileExplicit || envFile !== ".env.production.local")
  ) {
    throw new Error(
      "Remote Supabase targets require --env-file=.env.production.local",
    );
  }

  return target;
}

export function parseAllowlistArgs(args: string[]): AllowlistCommand {
  const positional: string[] = [];
  let envFile = ".env.local";
  let envFileSet = false;
  let note: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--env-file" || argument.startsWith("--env-file=")) {
      if (envFileSet) throw new Error("--env-file may only be specified once");
      const value =
        argument === "--env-file" ? args[++index] : argument.slice(11);
      if (!value) throw new Error("--env-file requires a path");
      envFile = value;
      envFileSet = true;
    } else if (argument === "--note") {
      if (note !== undefined)
        throw new Error("--note may only be specified once");
      note = args[++index];
      if (note === undefined || note.startsWith("--")) {
        throw new Error("--note requires text");
      }
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      positional.push(argument);
    }
  }

  const [command, email, ...extraArguments] = positional;
  if (!command) throw new Error("Expected add, remove, or list");

  if (command === "add") {
    if (!email || extraArguments.length > 0) {
      throw new Error("Usage: pnpm allowlist add <email> [--note text]");
    }
    return {
      command,
      email: normalizeEmail(email),
      ...(note === undefined ? {} : { note }),
      envFile,
      envFileExplicit: envFileSet,
    };
  }

  if (note !== undefined) throw new Error("--note is only valid with add");
  if (command === "remove") {
    if (!email || extraArguments.length > 0) {
      throw new Error("Usage: pnpm allowlist remove <email>");
    }
    return {
      command,
      email: normalizeEmail(email),
      envFile,
      envFileExplicit: envFileSet,
    };
  }

  if (command === "list") {
    if (email || extraArguments.length > 0) {
      throw new Error("Usage: pnpm allowlist list");
    }
    return { command, envFile, envFileExplicit: envFileSet };
  }

  throw new Error(`Unknown command: ${command}`);
}
