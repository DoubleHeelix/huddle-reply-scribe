
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { pdfProcessor } from '@/utils/pdfProcessor';

interface DocumentKnowledge {
  id: string;
  document_name: string;
  content_chunk: string;
  similarity: number;
  metadata: any;
}

export const useDocumentKnowledge = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processDocuments = useCallback(async (): Promise<boolean> => {
    setIsProcessing(true);
    setError(null);

    try {
      await pdfProcessor.processExistingDocuments();
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process documents';
      setError(errorMessage);
      console.error('Document processing error:', err);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const searchKnowledge = useCallback(async (query: string, limit: number = 5): Promise<DocumentKnowledge[]> => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('User not authenticated - skipping document knowledge search');
        return [];
      }

      console.log('Creating embedding for query:', query);

      // Create embedding for the query
      const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke('create-embedding', {
        body: { text: query }
      });

      if (embeddingError) {
        console.error('Error creating query embedding:', embeddingError);
        return [];
      }

      console.log('Embedding created successfully, searching documents...');

      // Search for similar documents with a much lower threshold for better results
      const { data, error } = await supabase.rpc('search_document_knowledge', {
        query_embedding: embeddingData.embedding,
        target_user_id: user.id,
        match_threshold: 0.1, // Much lower threshold to capture more potential matches
        match_count: limit * 2 // Get more results to filter from
      });

      if (error) {
        console.error('Error searching knowledge:', error);
        
        // Fallback: try a basic text search if vector search fails
        console.log('Attempting fallback text search...');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('document_knowledge')
          .select('id, document_name, content_chunk, metadata')
          .eq('user_id', user.id)
          .ilike('content_chunk', `%${query.split(' ').slice(0, 3).join('%')}%`)
          .limit(limit);

        if (fallbackError) {
          console.error('Fallback search also failed:', fallbackError);
          return [];
        }

        // Format fallback results to match expected structure
        const fallbackResults = (fallbackData || []).map(item => ({
          ...item,
          similarity: 0.5 // Default similarity for text-based matches
        }));

        console.log('Fallback search results:', fallbackResults);
        return fallbackResults;
      }

      console.log('Document search results:', data);
      
      // Filter results to only include those with reasonable similarity
      const filteredResults = (data || []).filter(item => item.similarity > 0.1);
      
      console.log('Filtered document search results:', filteredResults);
      return filteredResults.slice(0, limit);
    } catch (err) {
      console.error('Knowledge search error:', err);
      
      // Additional fallback: try to get any documents for debugging
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: debugData, error: debugError } = await supabase
            .from('document_knowledge')
            .select('document_name, content_chunk')
            .eq('user_id', user.id)
            .limit(3);
          
          console.log('Available documents for debugging:', debugData);
          if (debugError) console.error('Debug query error:', debugError);
        }
      } catch (debugErr) {
        console.error('Debug query failed:', debugErr);
      }
      
      return [];
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    processDocuments,
    searchKnowledge,
    isProcessing,
    error,
    clearError
  };
};
