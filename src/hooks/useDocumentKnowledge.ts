
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { documentService } from '@/services/documentService';
import { useDocumentSearch } from '@/hooks/useDocumentSearch';
import { useDocumentProcessing } from '@/hooks/useDocumentProcessing';
import { DocumentSummary } from '@/types/document';

export const useDocumentKnowledge = () => {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const { toast } = useToast();

  const { searchDocuments } = useDocumentSearch();
  const { 
    isProcessing, 
    error, 
    processStorageDocument: baseProcessStorageDocument, 
    clearError 
  } = useDocumentProcessing();

  const fetchDocuments = useCallback(async () => {
    try {
      const documentSummaries = await documentService.fetchDocuments();
      setDocuments(documentSummaries);
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  }, []);

  const processStorageDocument = useCallback(async (fileName: string) => {
    await baseProcessStorageDocument(fileName);
    await fetchDocuments();
  }, [baseProcessStorageDocument, fetchDocuments]);

  const deleteDocument = useCallback(async (documentName: string) => {
    try {
      await documentService.deleteDocument(documentName);

      toast({
        title: "Document deleted",
        description: `${documentName} has been removed from your knowledge base.`,
      });

      await fetchDocuments();
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  }, [fetchDocuments, toast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return {
    documents,
    isProcessing,
    error,
    processStorageDocument,
    deleteDocument,
    searchDocuments,
    clearError,
    refreshDocuments: fetchDocuments
  };
};
