import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDocumentKnowledge } from './useDocumentKnowledge';

interface GenerateReplyResult {
  reply: string;
  documentKnowledge?: any[];
  pastHuddles?: any[];
}

export const useEnhancedAISuggestions = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdjustingTone, setIsAdjustingTone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { searchKnowledge } = useDocumentKnowledge();

  const generateReply = async (
    screenshotText: string,
    userDraft: string,
    principles: string,
    isRegeneration: boolean = false
  ): Promise<GenerateReplyResult | null> => {
    try {
      setIsGenerating(true);
      setError(null);

      console.log('Enhanced AI: Generating reply with document knowledge...');

      // Search for relevant document knowledge with a lower threshold for better results
      const searchQuery = `${screenshotText} ${userDraft}`;
      console.log('Searching for document knowledge with query:', searchQuery);
      
      const relevantKnowledge = await searchKnowledge(searchQuery, 3);
      console.log(`Found ${relevantKnowledge.length} relevant document chunks:`, relevantKnowledge);

      const { data, error } = await supabase.functions.invoke('enhanced-ai-suggestions', {
        body: {
          action: 'generateReply',
          screenshotText,
          userDraft,
          principles,
          isRegeneration,
          documentKnowledge: relevantKnowledge
        },
      });

      if (error) {
        throw new Error(`Function Error: ${error.message}`);
      }

      console.log('AI Function response:', data);

      // Use real data if available, otherwise provide empty arrays
      const documentKnowledge = relevantKnowledge.length > 0 ? relevantKnowledge : [];
      const pastHuddles = data.pastHuddles || [];

      console.log('Final document knowledge:', documentKnowledge);
      console.log('Final past huddles:', pastHuddles);

      return {
        reply: data.reply || '',
        documentKnowledge,
        pastHuddles
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate reply';
      setError(errorMessage);
      console.error('Enhanced AI error:', err);
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
