import { describe, it, expect } from "vitest";
import { sanitizeHumanReply } from "./sanitizeHumanReply";

describe("sanitizeHumanReply", () => {
  it("replaces em/en dashes with space", () => {
    const input = "that's sick bro — my dad — said so";
    expect(sanitizeHumanReply(input)).toBe("that's sick bro my dad said so");
  });

  it("strips zero-width and control characters", () => {
    const input = "hello\u200B world\u0007!";
    expect(sanitizeHumanReply(input)).toBe("hello world!");
  });

  it("normalizes fancy quotes and ellipsis", () => {
    const input = "“wow…” they said ‘cool’";
    expect(sanitizeHumanReply(input)).toBe('"wow..." they said \'cool\'');
  });

  it("keeps emoji and common punctuation", () => {
    const input = "Great job 🎉 — really nice!";
    expect(sanitizeHumanReply(input)).toBe("Great job 🎉 really nice!");
  });
});
