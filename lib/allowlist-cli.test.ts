import { describe, expect, it } from "vitest";
import {
  getAllowlistTarget,
  normalizeEmail,
  parseAllowlistArgs,
} from "./allowlist-cli";

describe("normalizeEmail", () => {
  it("trims whitespace and lowercases valid addresses", () => {
    expect(normalizeEmail("  Feed.Admin+Test@Example.COM ")).toBe(
      "feed.admin+test@example.com",
    );
  });

  it.each([
    "",
    "missing-at.example.com",
    "two@@example.com",
    "user@localhost",
    "user..name@example.com",
    "user@-example.com",
    "user@example-.com",
    "user name@example.com",
  ])("rejects invalid addresses: %s", (email) => {
    expect(() => normalizeEmail(email)).toThrow("Invalid email address");
  });
});

describe("parseAllowlistArgs", () => {
  it("parses add, its note, and the explicit env file", () => {
    expect(
      parseAllowlistArgs([
        "add",
        "Person@Example.com",
        "--note",
        "course reviewer",
        "--env-file=.env.production.local",
      ]),
    ).toEqual({
      command: "add",
      email: "person@example.com",
      note: "course reviewer",
      envFile: ".env.production.local",
      envFileExplicit: true,
    });
  });

  it("supports the separate env-file option and remove command", () => {
    expect(
      parseAllowlistArgs([
        "remove",
        "Person@Example.com",
        "--env-file",
        ".env.local",
      ]),
    ).toEqual({
      command: "remove",
      email: "person@example.com",
      envFile: ".env.local",
      envFileExplicit: true,
    });
  });

  it("defaults list to .env.local", () => {
    expect(parseAllowlistArgs(["list"])).toEqual({
      command: "list",
      envFile: ".env.local",
      envFileExplicit: false,
    });
  });

  const invalidArgumentLists: string[][] = [
    [],
    ["add"],
    ["add", "person@example.com", "extra"],
    ["remove"],
    ["list", "person@example.com"],
    ["unknown"],
    ["add", "person@example.com", "--note"],
    ["remove", "person@example.com", "--note", "not valid here"],
    ["list", "--env-file="],
    ["list", "--unknown"],
  ];
  for (const args of invalidArgumentLists) {
    it(`rejects invalid arguments: ${JSON.stringify(args)}`, () => {
      expect(() => parseAllowlistArgs(args)).toThrow();
    });
  }
});

describe("getAllowlistTarget", () => {
  it("allows local Supabase with the default env file", () => {
    expect(
      getAllowlistTarget("http://127.0.0.1:55321", ".env.local", false).host,
    ).toBe("127.0.0.1:55321");
  });

  it("requires the explicit production env file for remote hosts", () => {
    expect(() =>
      getAllowlistTarget("https://project.supabase.co", ".env.local", false),
    ).toThrow("require --env-file=.env.production.local");
    expect(() =>
      getAllowlistTarget(
        "https://project.supabase.co",
        ".env.production.local",
        false,
      ),
    ).toThrow("require --env-file=.env.production.local");
    expect(
      getAllowlistTarget(
        "https://project.supabase.co",
        ".env.production.local",
        true,
      ).host,
    ).toBe("project.supabase.co");
  });
});
