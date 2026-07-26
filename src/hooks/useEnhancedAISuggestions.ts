
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeHumanReply } from '@/utils/sanitizeHumanReply';
import {
  RetryableGenerationError,
  runWithGenerationRetry,
} from '@/utils/generationRetryPolicy';
import {
  HuddleGenerationHttpError,
  streamHuddleReply,
} from '@/services/huddleGenerationService';
import type { DocumentKnowledge } from '@/types/document';
import type { PastHuddleReference } from '@/utils/huddlePlayService';
import type { AppliedStyleProfile } from '@/types/styleProfile';
import { inferDraftInputMode } from '@/utils/draftInput';

type PastHuddleWithSimilarity = PastHuddleReference;

interface GenerateReplyResult {
  reply: string;
  huddleId?: string;
  generationId?: string;
  pastHuddles?: PastHuddleWithSimilarity[];
  documentKnowledge?: DocumentKnowledge[];
  slangAddressTerms?: string[];
  styleProfile?: AppliedStyleProfile;
}

const sanitizeHuddleMeta = (items: unknown[]): PastHuddleWithSimilarity[] => {
  return (items || []).map((item) => {
    const h = item as Partial<PastHuddleWithSimilarity>;
    const hasText = Boolean(h.screenshot_text || h.user_draft || h.generated_reply || h.final_reply);
    return {
      id: h.id as string,
      created_at: h.created_at as string,
      similarity: h.similarity,
      screenshot_text: h.screenshot_text as string | undefined,
      user_draft: h.user_draft as string | undefined,
      generated_reply: h.generated_reply as string | undefined,
      final_reply: h.final_reply as string | undefined,
      __preview: !hasText,
    };
  });
};

const sanitizeDocumentMeta = (items: unknown[]): DocumentKnowledge[] => {
  return (items || []).map((item) => {
    const d = item as Partial<DocumentKnowledge> & { document_name?: string };
    const hasChunk = Boolean(d.content_chunk);
    return {
      id: d.id as string,
      document_name: d.document_name as string,
      content_chunk: d.content_chunk as string,
      similarity: (d.similarity as number) ?? 0,
      metadata: d.metadata as Record<string, unknown> | undefined,
      ...(hasChunk ? {} : ({ __preview: true } as Record<string, unknown>)),
    } as DocumentKnowledge;
  });
};

export const useEnhancedAISuggestions = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdjustingTone, setIsAdjustingTone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const generateReply = async (
    screenshotText: string,
    userDraft: string,
    isRegeneration: boolean = false,
    existingDocumentKnowledge: DocumentKnowledge[] = [],
    existingPastHuddles: PastHuddleWithSimilarity[] = [],
    onToken?: (partial: string, options?: { slangAddressTerms?: string[] }) => void,
    huddleId?: string | null,
    parentGenerationId?: string | null,
  ): Promise<GenerateReplyResult | null> => {
    const errorMessage = "Generation failed. Please click re-generate";
    const requestId = crypto.randomUUID();
    const draftInputMode = inferDraftInputMode(userDraft);
    let activeHuddleId = huddleId || undefined;
    let activeGenerationId = parentGenerationId || undefined;

    setIsGenerating(true);
    setError(null);

    try {
      try {
        return await runWithGenerationRetry(
          async (attempt, maxAttempts) => {
            console.log('Huddle generation started', {
              attempt,
              maxAttempts,
              isRegeneration: isRegeneration || attempt > 1,
            });

            let slangAddressTerms: string[] | undefined;
            let pastHuddles: PastHuddleWithSimilarity[] =
              isRegeneration ? existingPastHuddles : [];
            let documentKnowledgeUsed: DocumentKnowledge[] =
              isRegeneration ? existingDocumentKnowledge : [];
            let appliedStyleProfile: AppliedStyleProfile | undefined;

            const streamed = await streamHuddleReply(
              {
                screenshotText,
                userDraft,
                draftInputMode,
                isRegeneration: isRegeneration || attempt > 1,
                requestId,
                huddleId: activeHuddleId,
                parentGenerationId: activeGenerationId,
              },
              {
                onMeta: (meta) => {
                  activeHuddleId = meta.huddleId || activeHuddleId;
                  activeGenerationId =
                    meta.generationId || activeGenerationId;
                  pastHuddles = sanitizeHuddleMeta(meta.pastHuddles);
                  documentKnowledgeUsed = sanitizeDocumentMeta(
                    meta.documentKnowledge,
                  );
                  slangAddressTerms = meta.slangAddressTerms;
                  appliedStyleProfile = meta.styleProfile;
                },
                onToken: (partial, meta) => {
                  slangAddressTerms =
                    meta.slangAddressTerms || slangAddressTerms;
                  onToken?.(partial, { slangAddressTerms });
                },
              },
            );

            const trimmedReply = streamed.reply.trim();
            if (!trimmedReply || trimmedReply === errorMessage) {
              throw new RetryableGenerationError(
                "Generation returned no usable reply",
              );
            }
            onToken?.(streamed.reply, { slangAddressTerms });
            return {
              reply: streamed.reply,
              huddleId: activeHuddleId,
              generationId: activeGenerationId,
              pastHuddles,
              documentKnowledge: documentKnowledgeUsed,
              slangAddressTerms,
              styleProfile: appliedStyleProfile,
            };
          },
          {
            onRetry: ({
              attempt,
              nextAttempt,
              maxAttempts,
              delayMs,
              error: retryError,
            }) => {
              console.warn('🔁 DEBUG: Retrying transient generation failure', {
                attempt,
                nextAttempt,
                maxAttempts,
                delayMs,
                error:
                  retryError instanceof Error
                    ? retryError.message
                    : String(retryError),
              });
            },
          }
        );
      } catch (generationError) {
        console.error('❌ DEBUG: Generation failed after bounded retries', {
          lastError:
            generationError instanceof Error
              ? generationError.message
              : generationError,
          lastErrorStack:
            generationError instanceof Error
              ? generationError.stack
              : undefined,
          screenshotLength: screenshotText.length,
          draftLength: userDraft.length,
        });

        onToken?.("");
        const userFacingError =
          generationError instanceof HuddleGenerationHttpError
            ? generationError.message.replace(/\s*\(\d{3}\)\s*$/, "")
            : errorMessage;
        setError(userFacingError);
        return null;
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const adjustTone = async (
    originalReply: string,
    selectedTone: string
  ): Promise<string | null> => {
    if (!selectedTone || selectedTone === 'none') {
      return originalReply;
    }

    try {
      setIsAdjustingTone(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('enhanced-ai-suggestions', {
        body: {
          action: 'adjustTone',
          originalReply,
          selectedTone
        },
      });

      if (error) {
        throw new Error(`Function Error: ${error.message}`);
      }

      return data.reply || originalReply;
    } catch (err) {
      console.error('Tone adjustment error:', err);
      setError(err instanceof Error ? err.message : 'Failed to adjust tone');
      return originalReply;
    } finally {
      setIsAdjustingTone(false);
    }
  };

  const clearError = () => setError(null);

  return {
    generateReply,
    adjustTone,
    isGenerating,
    isAdjustingTone,
    error,
    clearError,
  };
};
