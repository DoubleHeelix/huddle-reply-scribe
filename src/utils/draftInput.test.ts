import { describe, expect, it } from "vitest";
import {
  getDraftInputGuidance,
  inferDraftInputMode,
} from "@/utils/draftInput";

describe("inferDraftInputMode", () => {
  it.each([
    "Tell him I am working on ecommerce and ask what he invests in",
    "Ask when they are free and keep it casual",
    "Say yes and ask what time",
    "Keep it brief but show interest",
    "Let them know I cannot make it and suggest Saturday",
    "Thank them and ask when they are free",
  ])("recognizes a short direction: %s", (value) => {
    expect(inferDraftInputMode(value)).toBe("direction");
  });

  it.each([
    "Yeah bro I have been working on an ecommerce project on the side. What kind of investments have you been looking at?",
    "Sounds good bro, see you Saturday!",
    "I cannot make it tonight, but I am free tomorrow if that works for you.",
    "Thanks for checking in. I really appreciate it.",
    "Thank you for checking in. I really appreciate it.",
    "Tell me when you are free and we can work something out.",
  ])("recognizes a complete draft: %s", (value) => {
    expect(inferDraftInputMode(value)).toBe("draft");
  });
});

describe("getDraftInputGuidance", () => {
  it("explains that the empty field accepts either input style", () => {
    expect(getDraftInputGuidance("")).toEqual({
      mode: null,
      message:
        "Write the exact message, or give Huddle a short direction and let it do more of the writing.",
    });
  });

  it("explains how a complete draft will be handled", () => {
    expect(
      getDraftInputGuidance("Sounds good bro, see you Saturday!").message,
    ).toContain("preserve your meaning");
  });
});
