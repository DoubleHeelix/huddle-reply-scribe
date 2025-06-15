
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
    const response = await fetch('/api/ai-suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generateReply',
        screenshotText,
        userDraft,
        principles,
        isRegeneration
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API Error: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }

    const data = await response.json();
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
    const response = await fetch('/api/ai-suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'adjustTone',
        originalReply,
        selectedTone
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API Error: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.reply || originalReply;
  } catch (error) {
    console.error('Error adjusting tone:', error);
    return originalReply; // Return original on error
  }
};
