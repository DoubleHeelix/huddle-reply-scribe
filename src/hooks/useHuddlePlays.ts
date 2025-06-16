
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { saveHuddlePlay, getUserHuddlePlays, updateHuddlePlayFinalReply, type HuddlePlay } from '@/utils/huddlePlayService';

export const useHuddlePlays = () => {
  const [huddlePlays, setHuddlePlays] = useState<HuddlePlay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchHuddlePlays = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const plays = await getUserHuddlePlays();
      setHuddlePlays(plays);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch huddle plays';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveCurrentHuddle = async (
    screenshotText: string,
    userDraft: string,
    generatedReply: string,
    selectedTone?: string
  ) => {
    try {
      const savedPlay = await saveHuddlePlay({
        screenshot_text: screenshotText,
        user_draft: userDraft,
        generated_reply: generatedReply,
        selected_tone: selectedTone,
      });

      if (savedPlay) {
        setHuddlePlays(prev => [savedPlay, ...prev]);
        toast({
          title: 'Huddle Saved',
          description: 'Your huddle play has been saved for future learning.',
        });
        return savedPlay.id;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save huddle play';
      toast({
        title: 'Save Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
    return null;
  };

  const updateFinalReply = async (id: string, finalReply: string) => {
    try {
      const success = await updateHuddlePlayFinalReply(id, finalReply);
      if (success) {
        setHuddlePlays(prev => 
          prev.map(play => 
            play.id === id 
              ? { ...play, final_reply: finalReply, updated_at: new Date().toISOString() }
              : play
          )
        );
      }
    } catch (err) {
      console.error('Error updating final reply:', err);
    }
  };

  useEffect(() => {
    fetchHuddlePlays();
  }, []);

  return {
    huddlePlays,
    isLoading,
    error,
    refetch: fetchHuddlePlays,
    saveCurrentHuddle,
    updateFinalReply,
  };
};
