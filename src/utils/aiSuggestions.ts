
import { supabase } from '@/integrations/supabase/client';

interface SuggestionOptions {
  screenshotText: string;
  userDraft: string;
  principles?: string;
  isRegeneration?: boolean;
}

interface ToneAdjustmentOptions {
  originalReply: string;
  selectedTone: string;
}

export const generateSuggestedReply = async ({
  screenshotText,
  userDraft,
  principles = '',
  isRegeneration = false,
}: SuggestionOptions): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('ai-suggestions', {
      body: {
        action: 'generateReply',
        screenshotText,
        userDraft,
        principles,
        isRegeneration
      },
    });

    if (error) {
      throw new Error(`Supabase Function Error: ${error.message}`);
    }

    return data.reply || '';
  } catch (error) {
    console.error('Error generating suggestion:', error);
    if (error instanceof Error) {
      throw new Error(`Error generating suggestion: ${error.message}`);
    }
    throw new Error('Unexpected error generating suggestion');
  }
};

export const generateAdjustedTone = async ({
  originalReply,
  selectedTone,
}: ToneAdjustmentOptions): Promise<string> => {
  if (!selectedTone || selectedTone.toLowerCase() === 'none') {
    return originalReply;
  }

  try {
    const { data, error } = await supabase.functions.invoke('ai-suggestions', {
      body: {
        action: 'adjustTone',
        originalReply,
        selectedTone
      },
    });

    if (error) {
      throw new Error(`Supabase Function Error: ${error.message}`);
    }

    return data.reply || originalReply;
  } catch (error) {
    console.error('Error adjusting tone:', error);
    return originalReply; // Return original on error
  }
};
