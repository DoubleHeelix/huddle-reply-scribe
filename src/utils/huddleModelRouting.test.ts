import { describe, expect, it } from "vitest";
import {
  applyEvaluatedRoutingPolicy,
  selectHuddleReplyModel,
} from "../../supabase/functions/shared/huddleModelRouting";

describe("evaluation-gated Huddle model routing", () => {
  const baseline = selectHuddleReplyModel({
    isRegeneration: false,
    contextIsHeavy: false,
  });

  it("keeps the proven baseline until the sample threshold is met", () => {
    expect(
      applyEvaluatedRoutingPolicy(baseline, {
        primary_model: "candidate-cheap-model",
        cheap_route_enabled: true,
        evaluated_sample_count: 24,
      }),
    ).toMatchObject({
      model: baseline.model,
      policyApplied: false,
    });
  });

  it("applies a cheaper candidate only after it is explicitly enabled and evaluated", () => {
    expect(
      applyEvaluatedRoutingPolicy(baseline, {
        primary_model: "candidate-cheap-model",
        cheap_route_enabled: true,
        evaluated_sample_count: 25,
      }),
    ).toMatchObject({
      model: "candidate-cheap-model",
      policyApplied: true,
    });
  });

  it("never applies a candidate just because it exists in the database", () => {
    expect(
      applyEvaluatedRoutingPolicy(baseline, {
        primary_model: "candidate-cheap-model",
        cheap_route_enabled: false,
        evaluated_sample_count: 100,
      }),
    ).toMatchObject({
      model: baseline.model,
      policyApplied: false,
    });
  });
});
