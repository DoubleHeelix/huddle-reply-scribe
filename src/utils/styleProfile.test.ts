import { describe, expect, it } from "vitest";
import {
  emptyStyleProfile,
  getStyleProfileSignals,
  getStyleProfileStrength,
  isUsefulStyleSignal,
  parseStyleProfile,
} from "@/types/styleProfile";

describe("style profile helpers", () => {
  it("safely parses stored JSON fields", () => {
    const profile = parseStyleProfile({
      huddle_count: 12,
      common_topics: ["work", "boxing"],
      common_phrases: { bigrams: ["yeah bro"], trigrams: ["keen for that"] },
      style_fingerprint: {
        typical_word_count: 24,
        slang_examples: ["bro"],
      },
      personal_profile: { location: "Melbourne" },
    });

    expect(profile.huddle_count).toBe(12);
    expect(profile.common_phrases.bigrams).toEqual(["yeah bro"]);
    expect(profile.style_fingerprint.typical_word_count).toBe(24);
    expect(profile.personal_profile.location).toBe("Melbourne");
  });

  it("scores a well-trained profile more strongly", () => {
    const emptyStrength = getStyleProfileStrength(emptyStyleProfile());
    const trained = parseStyleProfile({
      huddle_count: 30,
      common_topics: ["work", "boxing", "business", "melbourne"],
      common_phrases: {
        bigrams: ["yeah bro", "love that"],
        trigrams: ["keen for that", "what about you"],
      },
      style_fingerprint: {
        typical_word_count: 28,
        emoji_message_share: 0.2,
        question_per_sentence: 0.4,
        slang_examples: ["bro"],
        greetings: ["hey"],
        closings: ["let me know"],
      },
      personal_profile: {
        occupation: "Engineer",
        hobbies: "Boxing",
        location: "Melbourne",
      },
    });

    expect(getStyleProfileStrength(trained).score).toBeGreaterThan(
      emptyStrength.score,
    );
    expect(getStyleProfileStrength(trained).label).toBe("Strong");
    expect(getStyleProfileSignals(trained)).toContain("~28 words");
  });

  it("removes system placeholder text from voice signals", () => {
    const profile = parseStyleProfile({
      common_topics: ["boxing", "generate", "screenshot"],
      common_phrases: {
        bigrams: ["yeah bro", "screenshot context"],
        trigrams: ["plus any available", "keen for a chat"],
      },
      common_sentences: [
        "No explicit draft provided.",
        "Let me know what works for you.",
      ],
    });

    expect(profile.common_topics).toEqual(["boxing"]);
    expect(profile.common_phrases.bigrams).toEqual(["yeah bro"]);
    expect(profile.common_phrases.trigrams).toEqual(["keen for a chat"]);
    expect(profile.common_sentences).toEqual([
      "Let me know what works for you.",
    ]);
    expect(isUsefulStyleSignal("Generate the best possible reply")).toBe(false);
  });
});
