export const HUDDLE_MODELS = {
  primaryReply: "gpt-5.4-nano",
  fallbackReply: "gpt-5-mini",
  toneAdjustment: "gpt-4o-mini",
} as const;

export type HuddleReplyRoute = "primary" | "fallback";
export type HuddleReasoningEffort = "none" | "low" | "medium";
export type HuddleRoutingPolicy = {
  primary_model?: unknown;
  fallback_model?: unknown;
  evaluated_sample_count?: unknown;
  cheap_route_enabled?: unknown;
};

type SelectHuddleReplyModelOptions = {
  isRegeneration: boolean;
  contextIsHeavy: boolean;
};

export function selectHuddleReplyModel({
  isRegeneration,
  contextIsHeavy,
}: SelectHuddleReplyModelOptions): {
  model: string;
  reasoningEffort: HuddleReasoningEffort;
  route: HuddleReplyRoute;
} {
  if (isRegeneration) {
    return {
      model: HUDDLE_MODELS.fallbackReply,
      reasoningEffort: "medium",
      route: "fallback",
    };
  }

  return {
    model: HUDDLE_MODELS.primaryReply,
    reasoningEffort: contextIsHeavy ? "low" : "none",
    route: "primary",
  };
}

export function applyEvaluatedRoutingPolicy(
  selection: ReturnType<typeof selectHuddleReplyModel>,
  policy: HuddleRoutingPolicy | null | undefined,
  minimumSamples = 25,
): ReturnType<typeof selectHuddleReplyModel> & {
  policyApplied: boolean;
} {
  const sampleCount =
    typeof policy?.evaluated_sample_count === "number"
      ? policy.evaluated_sample_count
      : 0;
  const selectedPolicyModel =
    selection.route === "fallback"
      ? policy?.fallback_model
      : policy?.primary_model;
  const isEligible =
    policy?.cheap_route_enabled === true &&
    sampleCount >= minimumSamples &&
    typeof selectedPolicyModel === "string" &&
    selectedPolicyModel.trim().length > 0;

  return {
    ...selection,
    model: isEligible ? selectedPolicyModel.trim() : selection.model,
    policyApplied: isEligible,
  };
}
