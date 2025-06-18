import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface PastHuddleKnowledge {
  id: string;
  screenshot_text: string;
  user_draft: string;
  generated_reply: string;
  final_reply?: string;
  created_at: string;
  similarity: number;
}

export const usePastHuddlesKnowledge = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchPastHuddles = useCallback(async (query: string): Promise<PastHuddleKnowledge[]> => {
    if (!user) {
      console.log("No user found, skipping huddle search.");
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('search-past-huddles', {
        body: { query, userId: user.id },
      });

      if (error) {
        throw new Error(`Error searching past huddles: ${error.message}`);
      }
      
      return data as PastHuddleKnowledge[];
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    searchPastHuddles,
    isLoading,
    error,
  };
};