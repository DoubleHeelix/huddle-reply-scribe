export const shouldGenerateHuddleEmbedding = (
  isRegeneration: boolean,
  hasStoredHuddle = false,
): boolean => !isRegeneration && !hasStoredHuddle;
