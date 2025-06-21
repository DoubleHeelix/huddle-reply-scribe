import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { saveHuddlePlay, getUserHuddlePlays, updateHuddlePlayFinalReply, type HuddlePlay } from '@/utils/huddlePlayService';
import { useAuth } from './useAuth';

export const useHuddlePlays = () => {
  const { user } = useAuth();
  const [huddlePlays, setHuddlePlays] = useState<HuddlePlay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const saveCurrentHuddle = async (huddlePlay: Omit<HuddlePlay, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    try {
      const newPlay = await saveHuddlePlay(huddlePlay);
      setHuddlePlays(prev => [newPlay, ...prev]);
      return newPlay;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save huddle play';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    }
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
    if (user) {
      fetchHuddlePlays();
    } else {
      setIsLoading(false);
      setHuddlePlays([]);
    }
  }, [user]);

  return {
    huddlePlays,
    isLoading,
    error,
    refetch: fetchHuddlePlays,
    saveCurrentHuddle,
    updateFinalReply,
  };
};
