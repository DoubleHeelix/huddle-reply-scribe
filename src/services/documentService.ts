
import { supabase } from '@/integrations/supabase/client';
import { DocumentSummary } from '@/types/document';
import { pdfProcessor } from './pdfProcessor';

export const documentService = {
  async fetchDocuments(): Promise<DocumentSummary[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

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

    return Array.from(documentMap.entries()).map(
      ([name, info]) => ({
        document_name: name,
        chunks: info.chunks,
        processed_at: info.processed_at
      })
    );
  },

  async processDocumentFromStorage(fileName: string): Promise<any> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('📄 Processing document from storage with simple extraction:', fileName);
      
      // Use the simple extraction method
      const { text, pageCount, metadata } = await pdfProcessor.extractTextFromStorage(fileName);
      
      if (!text || text.length < 20) {
        throw new Error('Could not extract sufficient text from PDF.');
      }

      console.log('🔗 Sending extracted text to embedding function...');
      
      // Send the extracted text to the embedding function
      const { data, error } = await supabase.functions.invoke('create-embedding', {
        body: {
          document_name: fileName,
          extracted_text: text,
          user_id: user.id,
          metadata: {
            ...metadata,
            pageCount,
            processingMethod: 'simple-processing'
          }
        }
      });

      if (error) {
        throw new Error(`Processing failed: ${error.message}`);
      }

      console.log('✅ Document processing completed successfully');
      return data;
      
    } catch (error) {
      console.error('❌ Document processing error:', error);
      throw error;
    }
  },

  async processUploadedFile(file: File): Promise<any> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('📄 Processing uploaded PDF:', file.name);
      
      // Use the simple extraction method for uploaded files
      const { text, pageCount, metadata } = await pdfProcessor.extractTextFromFile(file);
      
      if (!text || text.length < 20) {
        throw new Error('Could not process PDF file.');
      }

      console.log('🔗 Sending extracted text to embedding function...');
      
      // Send the extracted text to the embedding function
      const { data, error } = await supabase.functions.invoke('create-embedding', {
        body: {
          document_name: file.name,
          extracted_text: text,
          user_id: user.id,
          metadata: {
            ...metadata,
            pageCount,
            processingMethod: 'simple-processing'
          }
        }
      });

      if (error) {
        throw new Error(`Processing failed: ${error.message}`);
      }

      console.log('✅ Document processing completed successfully');
      return data;
      
    } catch (error) {
      console.error('❌ Document processing error:', error);
      throw error;
    }
  },

  async deleteDocument(documentName: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('document_knowledge')
      .delete()
      .eq('user_id', user.id)
      .eq('document_name', documentName);

    if (error) throw error;
  }
};
