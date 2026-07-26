
import { supabase } from '@/integrations/supabase/client';

interface StoryResponseOptions {
  storyText: string;
  imageData: string;
  count?: number;
}

export const generateStoryResponse = async ({
  storyText,
  imageData,
  count = 3,
}: StoryResponseOptions): Promise<string[]> => {
  try {
    const { data, error } = await supabase.functions.invoke('generate-story-interruptions', {
      body: {
        storyText,
        imageData,
        count
      },
    });

    if (error) {
      throw new Error(`Supabase Function Error: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from function');
    }

    return data.conversationStarters || [];
  } catch (error) {
    console.error('Error generating story response:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw error;
  }
};
