
import { useState } from 'react';
import { generateSuggestedReply, generateAdjustedTone } from '@/utils/aiSuggestions';

export const useAISuggestions = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdjustingTone, setIsAdjustingTone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReply = async (
    screenshotText: string,
    userDraft: string,
    principles: string = '',
    isRegeneration: boolean = false
  ): Promise<string | null> => {
    setIsGenerating(true);
    setError(null);

    try {
      const reply = await generateSuggestedReply({
        screenshotText,
        userDraft,
        principles,
        isRegeneration
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
    setIsAdjustingTone(true);
    setError(null);

    try {
      const adjustedReply = await generateAdjustedTone({
        originalReply,
        selectedTone
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
