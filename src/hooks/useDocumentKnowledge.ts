
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

  const checkIfDocumentsExist = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('document_knowledge')
        .select('document_name')
        .eq('user_id', user.id)
        .limit(1);

      if (error) {
        console.error('Error checking documents:', error);
        return false;
      }

      return (data?.length || 0) > 0;
    } catch (err) {
      console.error('Error checking if documents exist:', err);
      return false;
    }
  }, []);

  const processDocuments = useCallback(async (): Promise<boolean> => {
    setIsProcessing(true);
    setError(null);

    try {
      // Check if documents already exist
      const documentsExist = await checkIfDocumentsExist();
      if (documentsExist) {
        console.log('Documents already processed, skipping...');
        setIsProcessing(false);
        return true;
      }

      console.log('Processing documents for the first time...');
      await pdfProcessor.processExistingDocuments();
      
      // Verify documents were processed
      const processedSuccessfully = await checkIfDocumentsExist();
      console.log('Documents processed successfully:', processedSuccessfully);
      
      return processedSuccessfully;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process documents';
      setError(errorMessage);
      console.error('Document processing error:', err);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [checkIfDocumentsExist]);

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
        
        // Fallback to text search immediately
        console.log('Attempting fallback text search...');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('document_knowledge')
          .select('id, document_name, content_chunk, metadata')
          .eq('user_id', user.id)
          .ilike('content_chunk', `%${query.split(' ').slice(0, 3).join('%')}%`)
          .limit(limit);

        if (fallbackError) {
          console.error('Fallback search failed:', fallbackError);
          return [];
        }

        const fallbackResults = (fallbackData || []).map(item => ({
          ...item,
          similarity: 0.5
        }));

        console.log('Fallback search results:', fallbackResults);
        return fallbackResults;
      }

      console.log('Embedding created successfully, searching documents...');

      // Search for similar documents with a very low threshold
      const { data, error } = await supabase.rpc('search_document_knowledge', {
        query_embedding: embeddingData.embedding,
        target_user_id: user.id,
        match_threshold: 0.05, // Even lower threshold
        match_count: limit * 3 // Get more results to filter from
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

        const fallbackResults = (fallbackData || []).map(item => ({
          ...item,
          similarity: 0.5
        }));

        console.log('Fallback search results:', fallbackResults);
        return fallbackResults;
      }

      console.log('Document search results:', data);
      
      // Filter results to only include those with reasonable similarity (very low bar)
      const filteredResults = (data || []).filter(item => item.similarity > 0.05);
      
      console.log('Filtered document search results:', filteredResults);
      return filteredResults.slice(0, limit);
    } catch (err) {
      console.error('Knowledge search error:', err);
      return [];
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    processDocuments,
    searchKnowledge,
    checkIfDocumentsExist,
    isProcessing,
    error,
    clearError
  };
};
