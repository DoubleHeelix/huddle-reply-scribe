
import { useState } from 'react';
import { generateSuggestedReply, generateAdjustedTone } from '@/utils/aiSuggestions';

interface UseAISuggestionsOptions {
  apiKey: string;
}

export const useAISuggestions = ({ apiKey }: UseAISuggestionsOptions) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdjustingTone, setIsAdjustingTone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReply = async (
    screenshotText: string,
    userDraft: string,
    principles: string = '',
    isRegeneration: boolean = false
  ): Promise<string | null> => {
    if (!apiKey) {
      setError('OpenAI API key is required');
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const reply = await generateSuggestedReply({
        screenshotText,
        userDraft,
        principles,
        isRegeneration,
        apiKey
      });
      
      return reply;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate reply';
      setError(errorMessage);
      console.error('Error generating reply:', err);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const adjustTone = async (
    originalReply: string,
    selectedTone: string
  ): Promise<string | null> => {
    if (!apiKey) {
      setError('OpenAI API key is required');
      return null;
    }

    setIsAdjustingTone(true);
    setError(null);

    try {
      const adjustedReply = await generateAdjustedTone({
        originalReply,
        selectedTone,
        apiKey
      });
      
      return adjustedReply;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to adjust tone';
      setError(errorMessage);
      console.error('Error adjusting tone:', err);
      return originalReply; // Return original on error
    } finally {
      setIsAdjustingTone(false);
    }
  };

  return {
    generateReply,
    adjustTone,
    isGenerating,
    isAdjustingTone,
    error,
    clearError: () => setError(null)
  };
};
