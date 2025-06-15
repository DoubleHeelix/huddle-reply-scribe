
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
    uploadDocument: baseUploadDocument, 
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

  const uploadDocument = useCallback(async (file: File) => {
    await baseUploadDocument(file);
    await fetchDocuments();
  }, [baseUploadDocument, fetchDocuments]);

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
    uploadDocument,
    deleteDocument,
    searchDocuments,
    clearError,
    refreshDocuments: fetchDocuments
  };
};
