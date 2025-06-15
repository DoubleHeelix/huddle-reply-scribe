
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

      // Create embedding for the query
      const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke('create-embedding', {
        body: { text: query }
      });

      if (embeddingError) {
        console.error('Error creating query embedding:', embeddingError);
        return [];
      }

      // Search for similar documents
      const { data, error } = await supabase.rpc('search_document_knowledge', {
        query_embedding: embeddingData.embedding,
        target_user_id: user.id,
        match_threshold: 0.7,
        match_count: limit
      });

      if (error) {
        console.error('Error searching knowledge:', error);
        return [];
      }

      return data || [];
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
    isProcessing,
    error,
    clearError
  };
};
