export type AdjustToneFn = (text: string, selectedTone: string) => Promise<string | null>;

export type GenerateReplyFn<TResult, TDocumentKnowledge = unknown, TPastHuddle = unknown> = (
  screenshotText: string,
  userDraft: string,
  isRegeneration: boolean,
  existingDocumentKnowledge: TDocumentKnowledge[],
  existingPastHuddles: TPastHuddle[],
  onToken?: (partial: string) => void
) => Promise<TResult | null>;

interface ApplyToneToDraftAndRegenerateParams<TResult, TDocumentKnowledge, TPastHuddle> {
  screenshotText: string;
  userDraft: string;
  selectedTone: string;
  adjustTone: AdjustToneFn;
  generateReply: GenerateReplyFn<TResult, TDocumentKnowledge, TPastHuddle>;
  onToken?: (partial: string) => void;
}

export async function applyToneToDraftAndRegenerate<TResult, TDocumentKnowledge = unknown, TPastHuddle = unknown>({
  screenshotText,
  userDraft,
  selectedTone,
  adjustTone,
  generateReply,
  onToken,
}: ApplyToneToDraftAndRegenerateParams<TResult, TDocumentKnowledge, TPastHuddle>): Promise<{
  adjustedDraft: string;
  result: TResult | null;
}> {
  const adjustedDraft = (await adjustTone(userDraft, selectedTone)) ?? userDraft;
  const result = await generateReply(
    screenshotText,
    adjustedDraft,
    false,
    [] as TDocumentKnowledge[],
    [] as TPastHuddle[],
    onToken
  );
  return { adjustedDraft, result };
}
