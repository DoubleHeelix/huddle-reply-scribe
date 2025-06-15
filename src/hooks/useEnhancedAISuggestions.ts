
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GenerateReplyResult {
  reply: string;
  pastHuddles?: any[];
}

export const useEnhancedAISuggestions = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdjustingTone, setIsAdjustingTone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReply = async (
    screenshotText: string,
    userDraft: string,
    principles: string,
    isRegeneration: boolean = false
  ): Promise<GenerateReplyResult | null> => {
    try {
      setIsGenerating(true);
      setError(null);

      console.log('🤖 DEBUG: Enhanced AI - Starting reply generation...');
      console.log('📸 DEBUG: Screenshot text length:', screenshotText.length);
      console.log('✏️ DEBUG: User draft length:', userDraft.length);

      console.log('🚀 DEBUG: Calling enhanced-ai-suggestions function...');

      const { data, error } = await supabase.functions.invoke('enhanced-ai-suggestions', {
        body: {
          action: 'generateReply',
          screenshotText,
          userDraft,
          principles,
          isRegeneration
        },
      });

      if (error) {
        throw new Error(`Function Error: ${error.message}`);
      }

      console.log('✅ DEBUG: AI Function response received:', {
        replyLength: data.reply?.length || 0,
        pastHuddlesCount: data.pastHuddles?.length || 0
      });

      const pastHuddles = data.pastHuddles || [];

      console.log('📊 DEBUG: Final response summary:', {
        replyGenerated: !!data.reply,
        pastHuddlesUsed: pastHuddles.length
      });

      return {
        reply: data.reply || '',
        pastHuddles
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
