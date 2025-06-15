
import { supabase } from '@/integrations/supabase/client';

interface StoryResponseOptions {
  storyText: string;
  imageUrl: string;
  count?: number;
}

export const generateStoryResponse = async ({
  storyText,
  imageUrl,
  count = 3,
}: StoryResponseOptions): Promise<string[]> => {
  try {
    console.log('Calling generate-story-interruptions function...');
    
    const { data, error } = await supabase.functions.invoke('generate-story-interruptions', {
      body: {
        storyText,
        imageUrl,
        count
      },
    });

    if (error) {
      console.error('Supabase function error details:', error);
      throw new Error(`Supabase Function Error: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from function');
    }

    console.log('Function response:', data);
    return data.conversationStarters || [];
  } catch (error) {
    console.error('Error generating story response:', error);
    if (error instanceof Error) {
      throw new Error(`Error generating story response: ${error.message}`);
    }
    throw new Error('Unexpected error generating story response');
  }
};
