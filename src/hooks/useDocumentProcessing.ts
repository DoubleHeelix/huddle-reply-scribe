
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

      console.log('📄 Starting document processing from storage:', fileName);

      const data = await documentService.processDocumentFromStorage(fileName);

      console.log('✅ Document processed successfully:', data);

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

  const uploadDocument = useCallback(async (file: File) => {
    try {
      setIsProcessing(true);
      setError(null);

      console.log('📄 Starting document upload:', file.name);

      // Convert file to base64
      const fileBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

      console.log('📄 Calling create-embedding function...');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

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

      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      console.error('Document upload error:', err);
      
      toast({
        title: "Upload failed",
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
    uploadDocument,
    clearError
  };
};
