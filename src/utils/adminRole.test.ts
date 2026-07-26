import { describe, expect, it } from "vitest";
import { hasAdminRole } from "./adminRole";

describe("hasAdminRole", () => {
  it("recognizes the primary admin role", () => {
    expect(hasAdminRole({ app_metadata: { role: "admin" } })).toBe(true);
  });

  it("recognizes admin in a roles array", () => {
    expect(
      hasAdminRole({ app_metadata: { roles: ["member", "admin"] } }),
    ).toBe(true);
  });

  it("does not grant admin access to ordinary users", () => {
    expect(hasAdminRole({ app_metadata: { role: "user" } })).toBe(false);
    expect(hasAdminRole(null)).toBe(false);
  });
});
