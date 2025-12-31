import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { saveHuddlePlay, getUserHuddlePlays, getHuddlePlayPreviews, getHuddlePlayDetail, updateHuddlePlayFinalReply, type HuddlePlay, type HuddlePlayPreview } from '@/utils/huddlePlayService';
import { useAuth } from './useAuth';

const PAGE_SIZE = 25;
const MAX_PAGES = 4; // Cap at 100 rows total.
const MAX_ROWS = PAGE_SIZE * MAX_PAGES;

const HUDDLE_SAVED_EVENT = 'huddle-play-saved';

type UseHuddlePlaysOptions = {
  paginated?: boolean;
  light?: boolean; // fetch lightweight list (metadata/previews) and hydrate on demand
  maxRows?: number; // cap rows per request to trim egress
  autoFetch?: boolean; // when false, skip initial fetch; caller can invoke refetch manually
};

export const useHuddlePlays = (options: UseHuddlePlaysOptions = {}) => {
  const { paginated = false, light = false, maxRows = MAX_ROWS, autoFetch = true } = options;
  const { user } = useAuth();
  const [huddlePlays, setHuddlePlays] = useState<(HuddlePlay & { __preview?: boolean })[]>([]);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(paginated);
  const { toast } = useToast();

  const fetchHuddlePlays = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const plays = light
        ? await getHuddlePlayPreviews(
            0,
            paginated ? PAGE_SIZE : maxRows,
            maxRows
          )
        : await getUserHuddlePlays(
            0,
            paginated ? PAGE_SIZE : maxRows,
            maxRows
          );
      const normalized = (plays as Array<HuddlePlay | HuddlePlayPreview>).map((p) => ({
        ...(p as HuddlePlay),
        __preview: light,
      }));
      setHuddlePlays(normalized);
      setPage(0);
      setHasMore(paginated && plays.length === PAGE_SIZE && MAX_PAGES > 1);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch huddle plays';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [paginated, toast]);

  const loadMore = useCallback(async () => {
    if (!paginated) return;
    if (isLoadingMore || isLoading || !hasMore) return;
    const nextPage = page + 1;
    if (nextPage >= MAX_PAGES) {
      setHasMore(false);
      return;
    }

    try {
      setIsLoadingMore(true);
      const more = light
        ? await getHuddlePlayPreviews(nextPage, PAGE_SIZE, maxRows)
        : await getUserHuddlePlays(nextPage, PAGE_SIZE, maxRows);
      setHuddlePlays((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newItems = more
          .filter((p) => !existingIds.has(p.id))
          .map((p) => ({ ...(p as HuddlePlay), __preview: light }));
        return [...prev, ...newItems];
      });
      setPage(nextPage);
      const reachedMaxPages = nextPage >= MAX_PAGES - 1;
      setHasMore(!reachedMaxPages && more.length === PAGE_SIZE);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch more huddle plays';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoading, isLoadingMore, page, paginated, toast]);

  const ensureHuddleDetail = useCallback(
    async (id: string) => {
      const existing = huddlePlays.find((p) => p.id === id);
      if (!existing || !existing.__preview) return existing || null;

      try {
        const detail = await getHuddlePlayDetail(id);
        if (!detail) return existing || null;
        setHuddlePlays((prev) =>
          prev.map((p) => (p.id === id ? { ...detail, __preview: false } : p))
        );
        return detail;
      } catch (err) {
        console.error('Error hydrating huddle play detail', err);
        return existing || null;
      }
    },
    [huddlePlays]
  );

  const saveCurrentHuddle = async (huddlePlay: Omit<HuddlePlay, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    try {
      const newPlay = await saveHuddlePlay(huddlePlay);
      if (newPlay) {
        setHuddlePlays(prev => [newPlay, ...prev]);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(HUDDLE_SAVED_EVENT, { detail: newPlay.id }));
        }
      }
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
    if (!user) {
      setIsLoading(false);
      setHuddlePlays([]);
      return;
    }
    if (!autoFetch) {
      setIsLoading(false);
      return;
    }
    fetchHuddlePlays();
  }, [autoFetch, fetchHuddlePlays, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!autoFetch) return;
    const handler = () => {
      fetchHuddlePlays();
    };
    window.addEventListener(HUDDLE_SAVED_EVENT, handler);
    return () => {
      window.removeEventListener(HUDDLE_SAVED_EVENT, handler);
    };
  }, [autoFetch, fetchHuddlePlays]);

  return {
    huddlePlays,
    isLoading,
    error,
    refetch: fetchHuddlePlays,
    hasMore,
    loadMore,
    isLoadingMore,
    page,
    ensureHuddleDetail,
    saveCurrentHuddle,
    updateFinalReply,
  };
};
