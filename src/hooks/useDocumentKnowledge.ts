
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DocumentSummary {
  document_name: string;
  chunks: number;
  processed_at: string;
}

interface DocumentKnowledge {
  id: string;
  document_name: string;
  content_chunk: string;
  similarity: number;
  metadata?: any;
}

export const useDocumentKnowledge = () => {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('document_knowledge')
        .select('document_name, processed_at')
        .eq('user_id', user.id);

      if (error) throw error;

      // Group by document and count chunks
      const documentMap = new Map<string, { processed_at: string; chunks: number }>();
      
      data.forEach(item => {
        if (documentMap.has(item.document_name)) {
          documentMap.get(item.document_name)!.chunks++;
        } else {
          documentMap.set(item.document_name, {
            processed_at: item.processed_at,
            chunks: 1
          });
        }
      });

      const documentSummaries: DocumentSummary[] = Array.from(documentMap.entries()).map(
        ([name, info]) => ({
          document_name: name,
          chunks: info.chunks,
          processed_at: info.processed_at
        })
      );

      setDocuments(documentSummaries);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Failed to load documents');
    }
  }, []);

  const processStorageDocument = useCallback(async (fileName: string) => {
    try {
      setIsProcessing(true);
      setError(null);

      console.log('📄 Starting document processing from storage:', fileName);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Download the file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(fileName);

      if (downloadError) {
        throw new Error(`Failed to download file: ${downloadError.message}`);
      }

      // Convert file to base64
      const fileBuffer = await fileData.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

      console.log('📄 Calling create-embedding function...');

      const { data, error } = await supabase.functions.invoke('create-embedding', {
        body: {
          document_name: fileName,
          document_content: base64,
          user_id: user.id
        }
      });

      if (error) {
        throw new Error(`Processing failed: ${error.message}`);
      }

      console.log('✅ Document processed successfully:', data);

      toast({
        title: "Document processed!",
        description: `${fileName} has been processed and added to your knowledge base.`,
      });

      // Refresh the documents list without causing recursion
      await fetchDocuments();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Processing failed';
      setError(errorMessage);
      console.error('Document processing error:', err);
      
      toast({
        title: "Processing failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast, fetchDocuments]);

  const uploadDocument = useCallback(async (file: File) => {
    try {
      setIsProcessing(true);
      setError(null);

      console.log('📄 Starting document upload:', file.name);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Convert file to base64
      const fileBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

      console.log('📄 Calling create-embedding function...');

      const { data, error } = await supabase.functions.invoke('create-embedding', {
        body: {
          document_name: file.name,
          document_content: base64,
          user_id: user.id
        }
      });

      if (error) {
        throw new Error(`Processing failed: ${error.message}`);
      }

      console.log('✅ Document processed successfully:', data);

      toast({
        title: "Document uploaded!",
        description: `${file.name} has been processed and added to your knowledge base.`,
      });

      // Refresh the documents list
      await fetchDocuments();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      console.error('Document upload error:', err);
      
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [fetchDocuments, toast]);

  const deleteDocument = useCallback(async (documentName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('document_knowledge')
        .delete()
        .eq('user_id', user.id)
        .eq('document_name', documentName);

      if (error) throw error;

      toast({
        title: "Document deleted",
        description: `${documentName} has been removed from your knowledge base.`,
      });

      // Refresh the documents list
      await fetchDocuments();
    } catch (err) {
      console.error('Error deleting document:', err);
      setError('Failed to delete document');
    }
  }, [fetchDocuments, toast]);

  const searchDocuments = useCallback(async (query: string, maxResults: number = 5): Promise<DocumentKnowledge[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      console.log('🔍 Searching documents for query:', query);

      // Generate embedding for the search query
      const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke('create-embedding', {
        body: {
          query_text: query,
          user_id: user.id
        }
      });

      if (embeddingError) {
        console.error('Error generating search embedding:', embeddingError);
        return [];
      }

      // Search for similar documents using the generated embedding
      const { data, error } = await supabase.rpc('search_document_knowledge', {
        query_embedding: embeddingData.embedding,
        target_user_id: user.id,
        match_threshold: 0.7,
        match_count: maxResults
      });

      if (error) {
        console.error('Error searching documents:', error);
        return [];
      }

      console.log(`📚 Found ${data?.length || 0} relevant document chunks`);
      return data || [];

    } catch (err) {
      console.error('Document search error:', err);
      return [];
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return {
    documents,
    isProcessing,
    error,
    processStorageDocument,
    uploadDocument,
    deleteDocument,
    searchDocuments,
    clearError,
    refreshDocuments: fetchDocuments
  };
};
