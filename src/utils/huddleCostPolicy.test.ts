import { describe, expect, it } from "vitest";
import { shouldGenerateHuddleEmbedding } from "../../supabase/functions/shared/huddleCostPolicy";

describe("shouldGenerateHuddleEmbedding", () => {
  it("generates one reusable embedding for an initial reply", () => {
    expect(shouldGenerateHuddleEmbedding(false)).toBe(true);
  });

  it("skips the unused embedding for a regeneration", () => {
    expect(shouldGenerateHuddleEmbedding(true)).toBe(false);
  });
});
