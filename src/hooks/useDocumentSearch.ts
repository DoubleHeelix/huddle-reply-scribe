
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DocumentKnowledge } from '@/types/document';

export const useDocumentSearch = () => {
  const searchDocuments = useCallback(async (query: string, maxResults: number = 5): Promise<DocumentKnowledge[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Generate embedding for the search query
      const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke('create-embedding', {
        body: {
          query_text: query
        }
      });

      if (embeddingError) {
        console.error('Error generating search embedding:', embeddingError);
        return [];
      }

      // Search for similar documents using the generated embedding
      const { data, error } = await supabase.rpc('search_document_knowledge', {
        query_embedding: embeddingData.embedding,
        match_threshold: 0.5,
        match_count: maxResults
      });

      if (error) {
        console.error('Error searching documents:', error);
        return [];
      }

      return (data || []).map((item) => ({
        ...item,
        metadata:
          item.metadata &&
          typeof item.metadata === 'object' &&
          !Array.isArray(item.metadata)
            ? (item.metadata as Record<string, unknown>)
            : undefined,
      }));

    } catch (err) {
      console.error('Document search error:', err);
      return [];
    }
  }, []);

  return { searchDocuments };
};
