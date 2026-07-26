
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { documentService } from '@/services/documentService';

export const useDocumentProcessing = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const processStorageDocument = useCallback(async (fileName: string) => {
    try {
      setIsProcessing(true);
      setError(null);

      const data = await documentService.processDocumentFromStorage(fileName);

      toast({
        title: "Document processed!",
        description: `${fileName} has been processed and added to your knowledge base.`,
      });

      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Processing failed';
      setError(errorMessage);
      console.error('Document processing error:', err);
      
      toast({
        title: "Processing failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  return {
    isProcessing,
    error,
    processStorageDocument,
    clearError
  };
};
