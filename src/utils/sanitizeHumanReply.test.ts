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

  it("preserves line breaks and paragraph boundaries", () => {
    const input = "First line.\nSecond line.\n\nSecond paragraph.";
    expect(sanitizeHumanReply(input)).toBe(input);
  });

  it("normalizes pasted line endings and excessive blank lines", () => {
    const input = "First paragraph.\r\n\r\n\r\nSecond paragraph.";
    expect(sanitizeHumanReply(input)).toBe(
      "First paragraph.\n\nSecond paragraph."
    );
  });

  it("normalizes tabs without removing line breaks", () => {
    const input = "First\tline.\n\nSecond\tline.";
    expect(sanitizeHumanReply(input)).toBe("First line.\n\nSecond line.");
  });

  it("normalizes fancy quotes and ellipsis", () => {
    const input = "“wow…” they said ‘cool’";
    expect(sanitizeHumanReply(input)).toBe('"wow..." they said \'cool\'');
  });

  it("keeps emoji and common punctuation", () => {
    const input = "Great job 🎉 — really nice!";
    expect(sanitizeHumanReply(input)).toBe("Great job 🎉 really nice!");
  });

  it("removes vocative commas before casual address terms", () => {
    const input = "That's really cool to hear, bro. whats new with you?";
    expect(sanitizeHumanReply(input)).toBe(
      "That's really cool to hear bro. whats new with you?"
    );
  });

  it("supports dynamic slang address terms", () => {
    const input = "Appreciate it, boss. thanks again!";
    expect(
      sanitizeHumanReply(input, { slangAddressTerms: ["boss"] })
    ).toBe("Appreciate it boss. thanks again!");
  });
});
