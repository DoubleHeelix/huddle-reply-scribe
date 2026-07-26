import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  getUserHuddlePlays,
  getHuddlePlayPreviews,
  getHuddlePlayDetail,
  recordHuddleAcceptance,
  type HuddleAcceptanceEvent,
  type HuddlePlay,
  type HuddlePlayPreview,
} from '@/utils/huddlePlayService';
import { useAuth } from './useAuth';

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_MAX_ROWS = 100;

type UseHuddlePlaysOptions = {
  paginated?: boolean;
  light?: boolean; // fetch lightweight list (metadata/previews) and hydrate on demand
  maxRows?: number; // cap rows per request to trim egress
  pageSize?: number; // number of rows fetched per paginated request
  autoFetch?: boolean; // when false, skip initial fetch; caller can invoke refetch manually
};

export const useHuddlePlays = (options: UseHuddlePlaysOptions = {}) => {
  const {
    paginated = false,
    light = false,
    maxRows = DEFAULT_MAX_ROWS,
    pageSize: requestedPageSize = DEFAULT_PAGE_SIZE,
    autoFetch = true,
  } = options;
  const pageSize = Math.max(1, Math.min(requestedPageSize, maxRows));
  const maxPages = Math.max(1, Math.ceil(maxRows / pageSize));
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
            paginated ? pageSize : maxRows,
            maxRows
          )
        : await getUserHuddlePlays(
            0,
            paginated ? pageSize : maxRows,
            maxRows
          );
      const normalized = (plays as Array<HuddlePlay | HuddlePlayPreview>).map((p) => ({
        ...(p as HuddlePlay),
        __preview: light,
      }));
      setHuddlePlays(normalized);
      setPage(0);
      setHasMore(paginated && plays.length === pageSize && maxPages > 1);
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
  }, [light, maxPages, maxRows, pageSize, paginated, toast]);

  const loadMore = useCallback(async () => {
    if (!paginated) return;
    if (isLoadingMore || isLoading || !hasMore) return;
    const nextPage = page + 1;
    if (nextPage >= maxPages) {
      setHasMore(false);
      return;
    }

    try {
      setIsLoadingMore(true);
      const more = light
        ? await getHuddlePlayPreviews(nextPage, pageSize, maxRows)
        : await getUserHuddlePlays(nextPage, pageSize, maxRows);
      setHuddlePlays((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newItems = more
          .filter((p) => !existingIds.has(p.id))
          .map((p) => ({ ...(p as HuddlePlay), __preview: light }));
        return [...prev, ...newItems];
      });
      setPage(nextPage);
      const reachedMaxPages = nextPage >= maxPages - 1;
      setHasMore(!reachedMaxPages && more.length === pageSize);
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
  }, [
    hasMore,
    isLoading,
    isLoadingMore,
    light,
    maxPages,
    maxRows,
    page,
    pageSize,
    paginated,
    toast,
  ]);

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

  const recordAcceptance = async (
    huddlePlayId: string,
    generationId: string | null,
    eventType: HuddleAcceptanceEvent,
    finalReply: string,
    metadata?: Record<string, string | number | boolean | null>,
  ) =>
    recordHuddleAcceptance(
      huddlePlayId,
      generationId,
      eventType,
      finalReply,
      metadata,
    );

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
    recordAcceptance,
  };
};
