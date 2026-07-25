import { describe, expect, it } from "vitest";
import {
  HUDDLE_MODELS,
  selectHuddleReplyModel,
} from "../../supabase/functions/shared/huddleModelRouting";

describe("selectHuddleReplyModel", () => {
  it("uses the intended provider model IDs", () => {
    expect(HUDDLE_MODELS).toEqual({
      primaryReply: "gpt-5.4-nano",
      fallbackReply: "gpt-5-mini",
      toneAdjustment: "gpt-4o-mini",
    });
  });

  it("uses the cost-efficient model without reasoning for a simple first pass", () => {
    expect(
      selectHuddleReplyModel({
        isRegeneration: false,
        contextIsHeavy: false,
      })
    ).toEqual({
      model: HUDDLE_MODELS.primaryReply,
      reasoningEffort: "none",
      route: "primary",
    });
  });

  it("uses low reasoning when the first pass has substantial context", () => {
    expect(
      selectHuddleReplyModel({
        isRegeneration: false,
        contextIsHeavy: true,
      })
    ).toEqual({
      model: HUDDLE_MODELS.primaryReply,
      reasoningEffort: "low",
      route: "primary",
    });
  });

  it("uses GPT-5 mini as the quality fallback for regenerations", () => {
    expect(
      selectHuddleReplyModel({
        isRegeneration: true,
        contextIsHeavy: false,
      })
    ).toEqual({
      model: HUDDLE_MODELS.fallbackReply,
      reasoningEffort: "medium",
      route: "fallback",
    });
  });
});
