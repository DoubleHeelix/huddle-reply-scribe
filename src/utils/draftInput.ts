export type DraftInputMode = "direction" | "draft";

const DIRECTION_OPENING =
  /^(?:please\s+)?(?:tell\s+(?:him|her|them|the user|the person)|ask\s+(?:(?:him|her|them)\b|when|what|where|why|how|if|whether)|say\s+(?:yes|no|that)\b|mention\s+that\b|explain\s+that\b|thank\s+(?:him|her|them)\b|apologize\s+(?:to\b|for\b)|decline\b|accept\s+(?:the|their)\b|agree\s+(?:and|but|to|with)\b|confirm\s+that\b|reassure\s+(?:him|her|them)\b|congratulate\s+(?:him|her|them)\b|invite\s+(?:him|her|them)\b|suggest\s+that\b|remind\s+(?:him|her|them)\b|let\s+(?:him|her|them|the user|the person)\s+know)\b/i;

const DIRECTION_LANGUAGE =
  /\b(?:keep (?:it|the reply) (?:brief|short|casual|friendly|warm|direct|polite|professional)|make (?:it|the reply) (?:brief|short|casual|friendly|warm|direct|polite|professional)|sound more (?:casual|friendly|warm|direct|polite|professional)|use a (?:casual|friendly|warm|direct|polite|professional) tone|follow[- ]?up|ask (?:him|her|them)|tell (?:him|her|them)|say that|mention that|let (?:him|her|them) know|set a boundary|show interest)\b/i;

export function inferDraftInputMode(value: string): DraftInputMode {
  const text = value.trim();
  if (!text) return "direction";

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (DIRECTION_OPENING.test(text)) return "direction";
  if (wordCount <= 60 && DIRECTION_LANGUAGE.test(text)) return "direction";

  return "draft";
}

export function getDraftInputGuidance(value: string): {
  mode: DraftInputMode | null;
  message: string;
} {
  const text = value.trim();
  if (!text) {
    return {
      mode: null,
      message:
        "Write the exact message, or give Huddle a short direction and let it do more of the writing.",
    };
  }

  const mode = inferDraftInputMode(text);
  return mode === "direction"
    ? {
        mode,
        message:
          "Using this as a direction. Huddle will build the reply in your voice.",
      }
    : {
        mode,
        message:
          "Using this as your draft. Huddle will preserve your meaning and strongest wording.",
      };
}
