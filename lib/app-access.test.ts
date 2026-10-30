import { describe, expect, it } from "vitest";
import { getAppAccessRedirect } from "./app-access";

describe("getAppAccessRedirect", () => {
  it("sends users without verified identity to login", () => {
    expect(getAppAccessRedirect(false)).toBe("/login");
  });

  it("does not redirect any verified user", () => {
    expect(getAppAccessRedirect(true)).toBeNull();
  });
});
