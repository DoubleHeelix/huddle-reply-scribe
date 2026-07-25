export const HUDDLE_MODELS = {
  primaryReply: "gpt-5.4-nano",
  fallbackReply: "gpt-5-mini",
  toneAdjustment: "gpt-4o-mini",
} as const;

export type HuddleReplyRoute = "primary" | "fallback";
export type HuddleReasoningEffort = "none" | "low" | "medium";

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
