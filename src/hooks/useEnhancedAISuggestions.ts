
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDocumentKnowledge } from '@/hooks/useDocumentKnowledge';
import { sanitizeHumanReply } from '@/utils/sanitizeHumanReply';
import type { DocumentKnowledge } from '@/types/document';
import type { HuddlePlay } from '@/utils/huddlePlayService';

type PastHuddleWithSimilarity = HuddlePlay & { similarity?: number; __preview?: boolean };

interface GenerateReplyResult {
  reply: string;
  pastHuddles?: PastHuddleWithSimilarity[];
  documentKnowledge?: DocumentKnowledge[];
  slangAddressTerms?: string[];
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

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
  
  const { searchDocuments } = useDocumentKnowledge();

  const generateReply = async (
    screenshotText: string,
    userDraft: string,
    isRegeneration: boolean = false,
    existingDocumentKnowledge: DocumentKnowledge[] = [],
    existingPastHuddles: PastHuddleWithSimilarity[] = [],
    onToken?: (partial: string, options?: { slangAddressTerms?: string[] }) => void,
    allowAutoRegenerate: boolean = true
  ): Promise<GenerateReplyResult | null> => {
    const errorMessage = "Generation failed. Please click re-generate";
    const maxAttempts = 5;
    let lastError: unknown = null;
    let lastDocumentKnowledge = existingDocumentKnowledge;
    let lastPastHuddles = existingPastHuddles;

    setIsGenerating(true);
    setError(null);

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(`🤖 DEBUG: Enhanced AI - Starting reply generation (attempt ${attempt}/${maxAttempts})...`);
          console.log('📸 DEBUG: Screenshot text length:', screenshotText.length);
          console.log('✏️ DEBUG: User draft length:', userDraft.length);

          // Search for relevant documents based on screenshot + draft content
          let documentKnowledge: DocumentKnowledge[] = [];
          if (isRegeneration) {
            documentKnowledge = existingDocumentKnowledge;
            console.log(`📚 DEBUG: Re-using ${documentKnowledge.length} document chunks for regeneration`);
          } else {
            if (attempt === 1) {
              console.log('📚 DEBUG: Searching for relevant documents...');
              const searchQuery = `${screenshotText} ${userDraft}`;
              documentKnowledge = await searchDocuments(searchQuery, 3);
              console.log(`📚 DEBUG: Found ${documentKnowledge.length} relevant document chunks`);
            } else {
              documentKnowledge = existingDocumentKnowledge;
              console.log(`📚 DEBUG: Re-using document knowledge on retry: ${documentKnowledge.length}`);
            }
          }
          lastDocumentKnowledge = documentKnowledge;

          console.log('🚀 DEBUG: Calling enhanced-ai-suggestions function...');

          if (!SUPABASE_URL) {
            throw new Error('SUPABASE_URL is not configured.');
          }

          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;

          const response = await fetch(`${SUPABASE_URL}/functions/v1/enhanced-ai-suggestions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify({
              action: 'generateReply',
              screenshotText,
              userDraft,
              isRegeneration,
              documentKnowledge,
              returnLightweight: true, // ask backend to keep meta small; we still send full text for quality
            }),
          });

          if (!response.ok || !response.body) {
            const errorText = await response.text();
            throw new Error(`Function Error: ${response.status} ${response.statusText}: ${errorText}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let reply = '';
          let slangAddressTerms: string[] | undefined;
          let pastHuddles: PastHuddleWithSimilarity[] = isRegeneration ? existingPastHuddles : [];
          let documentKnowledgeUsed: DocumentKnowledge[] = documentKnowledge;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const payload = JSON.parse(line);
                if (payload.type === 'meta') {
                  pastHuddles = isRegeneration ? existingPastHuddles : sanitizeHuddleMeta(payload.pastHuddles || []);
                  documentKnowledgeUsed = sanitizeDocumentMeta(payload.documentKnowledge || documentKnowledge);
                  slangAddressTerms = Array.isArray(payload.slangAddressTerms)
                    ? payload.slangAddressTerms
                    : slangAddressTerms;
                  lastPastHuddles = pastHuddles;
                  lastDocumentKnowledge = documentKnowledgeUsed;
                } else if (payload.type === 'token') {
                  reply += payload.text || '';
                  if (onToken) onToken(reply, { slangAddressTerms });
                }
              } catch (err) {
                console.error('❌ DEBUG: Error parsing stream payload:', err, line);
              }
            }
          }

          // Process any trailing buffer content that wasn't newline-terminated.
          if (buffer.trim()) {
            try {
              const payload = JSON.parse(buffer);
              if (payload.type === 'meta') {
                pastHuddles = isRegeneration ? existingPastHuddles : sanitizeHuddleMeta(payload.pastHuddles || []);
                documentKnowledgeUsed = sanitizeDocumentMeta(payload.documentKnowledge || documentKnowledge);
                slangAddressTerms = Array.isArray(payload.slangAddressTerms)
                  ? payload.slangAddressTerms
                  : slangAddressTerms;
                lastPastHuddles = pastHuddles;
                lastDocumentKnowledge = documentKnowledgeUsed;
              } else if (payload.type === 'token') {
                reply += payload.text || '';
                if (onToken) onToken(reply, { slangAddressTerms });
              }
            } catch (err) {
              console.error('❌ DEBUG: Error parsing trailing stream payload:', err, buffer);
            }
          }

          console.log('✅ DEBUG: AI Function stream complete:', {
            replyLength: reply.length,
            pastHuddlesCount: pastHuddles.length,
            documentKnowledgeCount: documentKnowledgeUsed.length
          });

          const trimmedReply = reply.trim();
          if (!trimmedReply) {
            throw new Error('Empty reply from AI function');
          }

          if (trimmedReply === errorMessage && allowAutoRegenerate) {
            console.log('🔁 DEBUG: Auto-regenerating after fallback reply...');
            return await generateReply(
              screenshotText,
              userDraft,
              true,
              documentKnowledgeUsed,
              pastHuddles,
              onToken,
              false
            );
          } else if (trimmedReply === errorMessage) {
            console.error('❌ DEBUG: Reply equals fallback error after attempts', {
              attempts: attempt,
              pastHuddlesCount: pastHuddles.length,
              documentKnowledgeCount: documentKnowledgeUsed.length,
              replyLength: trimmedReply.length,
            });
          }

          // Ensure UI sees the final reply even if no tokens were streamed.
          if (reply && onToken) onToken(reply, { slangAddressTerms });

          return {
            reply,
            pastHuddles,
            documentKnowledge: documentKnowledgeUsed,
            slangAddressTerms,
          };
        } catch (err) {
          lastError = err;
          console.error(
            `❌ DEBUG: Enhanced AI attempt ${attempt}/${maxAttempts} failed`,
            err instanceof Error ? err.message : err
          );
          if (attempt === maxAttempts) break;
          console.log('🔁 DEBUG: Retrying generation...');
        }
      }

      if (allowAutoRegenerate) {
        console.log('🔁 DEBUG: Auto-regenerating after repeated failures...');
        return await generateReply(
          screenshotText,
          userDraft,
          true,
          lastDocumentKnowledge,
          lastPastHuddles,
          onToken,
          false
        );
      }

      console.error('❌ DEBUG: Generation failed after retries', {
        attempts: maxAttempts,
        lastError: lastError instanceof Error ? lastError.message : lastError,
        lastErrorStack: lastError instanceof Error ? lastError.stack : undefined,
        screenshotLength: screenshotText.length,
        draftLength: userDraft.length,
      });

      if (onToken) onToken(errorMessage);
      setError(errorMessage);
      return {
        reply: errorMessage,
        pastHuddles: [],
        documentKnowledge: [],
      };
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
