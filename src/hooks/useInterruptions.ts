
import { useState } from 'react';
import { generateStoryResponse } from '@/utils/interruptionsService';

export const useInterruptions = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateConversationStarters = async (
    storyText: string,
    imageUrl: string,
    count: number = 3
  ): Promise<string[] | null> => {
    setIsGenerating(true);
    setError(null);

    try {
      const starters = await generateStoryResponse({
        storyText,
        imageUrl,
        count
      });
      
      return starters;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate conversation starters';
      setError(errorMessage);
      console.error('Error generating conversation starters:', err);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateConversationStarters,
    isGenerating,
    error,
    clearError: () => setError(null)
  };
};
