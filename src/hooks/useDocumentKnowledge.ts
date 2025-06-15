
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
      
      // Check if user is authenticated before processing
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Please sign in to process documents');
      }
      
      console.log('👤 DEBUG: User authenticated, proceeding with processing...');
      
      // Use the new storage-based processing
      await pdfProcessor.processStorageDocuments('documents');
      console.log('✅ DEBUG: Document processing completed successfully');
      return true;
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

      // First, let's check what documents are available in the database
      const { data: availableDocs, error: docsError } = await supabase
        .from('document_knowledge')
        .select('document_name, content_chunk')
        .eq('user_id', user.id)
        .limit(5);

      if (docsError) {
        console.error('❌ DEBUG: Error checking available documents:', docsError);
      } else {
        console.log(`📄 DEBUG: Found ${availableDocs?.length || 0} document chunks in database for user:`, 
          availableDocs?.map(d => ({ name: d.document_name, preview: d.content_chunk.substring(0, 100) + '...' })));
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

      // Search for similar documents with a much lower threshold for better results
      console.log('🎯 DEBUG: Searching documents with vector similarity...');
      const { data, error } = await supabase.rpc('search_document_knowledge', {
        query_embedding: embeddingData.embedding,
        target_user_id: user.id,
        match_threshold: 0.1, // Much lower threshold to capture more potential matches
        match_count: limit * 2 // Get more results to filter from
      });

      if (error) {
        console.error('❌ DEBUG: Error in vector search:', error);
        
        // Fallback: try a basic text search if vector search fails
        console.log('🔄 DEBUG: Attempting fallback text search...');
        const searchTerms = query.split(' ').filter(word => word.length > 2).slice(0, 3);
        console.log('🔍 DEBUG: Using search terms:', searchTerms);
        
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('document_knowledge')
          .select('id, document_name, content_chunk, metadata')
          .eq('user_id', user.id)
          .or(searchTerms.map(term => `content_chunk.ilike.%${term}%`).join(','))
          .limit(limit);

        if (fallbackError) {
          console.error('❌ DEBUG: Fallback search also failed:', fallbackError);
          return [];
        }

        // Format fallback results to match expected structure
        const fallbackResults = (fallbackData || []).map(item => ({
          ...item,
          similarity: 0.5 // Default similarity for text-based matches
        }));

        console.log(`✅ DEBUG: Fallback search found ${fallbackResults.length} results:`, 
          fallbackResults.map(r => ({ name: r.document_name, similarity: r.similarity, preview: r.content_chunk.substring(0, 100) + '...' })));
        return fallbackResults;
      }

      console.log(`🎯 DEBUG: Vector search returned ${data?.length || 0} raw results`);
      
      // Filter results to only include those with reasonable similarity
      const filteredResults = (data || []).filter(item => item.similarity > 0.1);
      
      console.log(`✅ DEBUG: After filtering (similarity > 0.1): ${filteredResults.length} results`);
      filteredResults.forEach((result, index) => {
        console.log(`📋 DEBUG: Result ${index + 1}:`, {
          document: result.document_name,
          similarity: (result.similarity * 100).toFixed(1) + '%',
          preview: result.content_chunk.substring(0, 150) + '...'
        });
      });
      
      const finalResults = filteredResults.slice(0, limit);
      console.log(`🎯 DEBUG: Final results being returned: ${finalResults.length} documents`);
      
      return finalResults;
    } catch (err) {
      console.error('❌ DEBUG: Knowledge search error:', err);
      
      // Additional fallback: try to get any documents for debugging
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: debugData, error: debugError } = await supabase
            .from('document_knowledge')
            .select('document_name, content_chunk')
            .eq('user_id', user.id)
            .limit(3);
          
          console.log('🐛 DEBUG: Available documents for debugging:', debugData);
          if (debugError) console.error('❌ DEBUG: Debug query error:', debugError);
        }
      } catch (debugErr) {
        console.error('❌ DEBUG: Debug query failed:', debugErr);
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
