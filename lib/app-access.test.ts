import { describe, expect, it } from "vitest";
import { getAppAccessRedirect } from "./app-access";

describe("getAppAccessRedirect", () => {
  it("sends users without verified identity to login", () => {
    expect(getAppAccessRedirect(false, false)).toBe("/login");
    expect(getAppAccessRedirect(false, true)).toBe("/login");
  });

  it("sends verified users without allowlist access to no access", () => {
    expect(getAppAccessRedirect(true, false)).toBe("/no-access");
  });

  it("does not redirect verified allowlisted users", () => {
    expect(getAppAccessRedirect(true, true)).toBeNull();
  });
});
