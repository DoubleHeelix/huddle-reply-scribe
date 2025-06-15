
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
      console.log('🔄 DEBUG: Starting document processing...');
      const success = await pdfProcessor.processStorageDocuments('documents');
      console.log('✅ DEBUG: Document processing completed successfully');
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process documents';
      setError(errorMessage);
      console.error('❌ DEBUG: Document processing error:', err);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const searchKnowledge = useCallback(async (query: string, limit: number = 5): Promise<DocumentKnowledge[]> => {
    try {
      console.log('🔍 DEBUG: Starting document knowledge search for query:', query);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('⚠️ DEBUG: User not authenticated - skipping document knowledge search');
        return [];
      }

      console.log('👤 DEBUG: User authenticated, user ID:', user.id);

      // First, check what documents are available and filter out error entries
      const { data: availableDocs, error: docsError } = await supabase
        .from('document_knowledge')
        .select('document_name, content_chunk')
        .eq('user_id', user.id)
        .not('content_chunk', 'like', '%Unable to extract text%')
        .not('content_chunk', 'like', '%PDF processing failed%')
        .limit(10);

      if (docsError) {
        console.error('❌ DEBUG: Error checking available documents:', docsError);
      } else {
        console.log(`📄 DEBUG: Found ${availableDocs?.length || 0} valid document chunks in database for user`);
      }

      // If no valid documents found, return empty array
      if (!availableDocs || availableDocs.length === 0) {
        console.log('⚠️ DEBUG: No valid document content found in database');
        return [];
      }

      console.log('🧠 DEBUG: Creating embedding for query:', query);

      // Create embedding for the query
      const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke('create-embedding', {
        body: { text: query }
      });

      if (embeddingError) {
        console.error('❌ DEBUG: Error creating query embedding:', embeddingError);
        return [];
      }

      console.log('✅ DEBUG: Embedding created successfully, length:', embeddingData.embedding?.length);

      // Search for similar documents with vector similarity
      console.log('🎯 DEBUG: Searching documents with vector similarity...');
      const { data, error } = await supabase.rpc('search_document_knowledge', {
        query_embedding: embeddingData.embedding,
        target_user_id: user.id,
        match_threshold: 0.1,
        match_count: limit * 2
      });

      if (error) {
        console.error('❌ DEBUG: Error in vector search:', error);
        
        // Fallback: try a basic text search
        console.log('🔄 DEBUG: Attempting fallback text search...');
        const searchTerms = query.split(' ').filter(word => word.length > 2).slice(0, 3);
        
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('document_knowledge')
          .select('id, document_name, content_chunk, metadata')
          .eq('user_id', user.id)
          .not('content_chunk', 'like', '%Unable to extract text%')
          .not('content_chunk', 'like', '%PDF processing failed%')
          .or(searchTerms.map(term => `content_chunk.ilike.%${term}%`).join(','))
          .limit(limit);

        if (fallbackError) {
          console.error('❌ DEBUG: Fallback search also failed:', fallbackError);
          return [];
        }

        const fallbackResults = (fallbackData || []).map(item => ({
          ...item,
          similarity: 0.5
        }));

        console.log(`✅ DEBUG: Fallback search found ${fallbackResults.length} results`);
        return fallbackResults;
      }

      // Filter out error entries and low similarity results
      const validResults = (data || []).filter(item => 
        item.similarity > 0.1 && 
        !item.content_chunk.includes('Unable to extract text') &&
        !item.content_chunk.includes('PDF processing failed')
      );
      
      console.log(`✅ DEBUG: Vector search returned ${validResults.length} valid results`);
      validResults.forEach((result, index) => {
        console.log(`📋 DEBUG: Result ${index + 1}:`, {
          document: result.document_name,
          similarity: (result.similarity * 100).toFixed(1) + '%',
          preview: result.content_chunk.substring(0, 150) + '...'
        });
      });
      
      const finalResults = validResults.slice(0, limit);
      console.log(`🎯 DEBUG: Final results being returned: ${finalResults.length} documents`);
      
      return finalResults;
    } catch (err) {
      console.error('❌ DEBUG: Knowledge search error:', err);
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
