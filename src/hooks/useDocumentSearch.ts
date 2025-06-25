
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DocumentKnowledge } from '@/types/document';

export const useDocumentSearch = () => {
  const searchDocuments = useCallback(async (query: string, maxResults: number = 5): Promise<DocumentKnowledge[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      console.log('🔍 Searching documents for query:', query);

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
      console.log('🔍 Calling search_document_knowledge with:', {
        match_threshold: 0.5,
        match_count: maxResults
      });

      const { data, error } = await supabase.rpc('search_document_knowledge', {
        query_embedding: embeddingData.embedding,
        match_threshold: 0.5,
        match_count: maxResults
      });

      if (error) {
        console.error('Error searching documents:', error);
        return [];
      }

      console.log('✅ search_document_knowledge returned:', data);

      console.log(`📚 Found ${data?.length || 0} relevant document chunks`);
      return data || [];

    } catch (err) {
      console.error('Document search error:', err);
      return [];
    }
  }, []);

  return { searchDocuments };
};
