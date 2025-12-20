
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDocumentKnowledge } from '@/hooks/useDocumentKnowledge';
import type { DocumentKnowledge } from '@/types/document';
import type { HuddlePlay } from '@/utils/huddlePlayService';

type PastHuddleWithSimilarity = HuddlePlay & { similarity?: number };

interface GenerateReplyResult {
  reply: string;
  pastHuddles?: PastHuddleWithSimilarity[];
  documentKnowledge?: DocumentKnowledge[];
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

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
    onToken?: (partial: string) => void
  ): Promise<GenerateReplyResult | null> => {
    try {
      setIsGenerating(true);
      setError(null);

      console.log('🤖 DEBUG: Enhanced AI - Starting reply generation...');
      console.log('📸 DEBUG: Screenshot text length:', screenshotText.length);
      console.log('✏️ DEBUG: User draft length:', userDraft.length);

      // Search for relevant documents based on screenshot + draft content
      let documentKnowledge: DocumentKnowledge[] = [];
      if (isRegeneration) {
        documentKnowledge = existingDocumentKnowledge;
        console.log(`📚 DEBUG: Re-using ${documentKnowledge.length} document chunks for regeneration`);
      } else {
        console.log('📚 DEBUG: Searching for relevant documents...');
        const searchQuery = `${screenshotText} ${userDraft}`;
        documentKnowledge = await searchDocuments(searchQuery, 3);
        console.log(`📚 DEBUG: Found ${documentKnowledge.length} relevant document chunks`);
      }

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
              pastHuddles = isRegeneration ? existingPastHuddles : (payload.pastHuddles || []);
              documentKnowledgeUsed = payload.documentKnowledge || documentKnowledge;
            } else if (payload.type === 'token') {
              reply += payload.text || '';
              if (onToken) onToken(reply);
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
            pastHuddles = isRegeneration ? existingPastHuddles : (payload.pastHuddles || []);
            documentKnowledgeUsed = payload.documentKnowledge || documentKnowledge;
          } else if (payload.type === 'token') {
            reply += payload.text || '';
            if (onToken) onToken(reply);
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

      // Ensure UI sees the final reply even if no tokens were streamed.
      if (reply && onToken) onToken(reply);

      return {
        reply,
        pastHuddles,
        documentKnowledge: documentKnowledgeUsed
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate reply';
      setError(errorMessage);
      console.error('❌ DEBUG: Enhanced AI error:', err);
      return null;
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
