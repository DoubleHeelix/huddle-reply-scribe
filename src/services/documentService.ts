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
      console.log('📄 Starting client-side processing for:', fileName);
      
      // 1. Extract text on the client
      const { text, pageCount, metadata } = await pdfProcessor.extractTextFromStorage(fileName);
      
      if (!text || text.length < 20) {
        throw new Error('Could not extract sufficient text from PDF.');
      }

      // 2. Chunk the text on the client
      const textChunks = this.splitTextIntoChunks(text);
      console.log(`📝 Text split into ${textChunks.length} chunks on the client.`);

      // 3. Process each chunk individually
      for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i];
        console.log(`🔗 Sending chunk ${i + 1}/${textChunks.length} to embedding function...`);
        
        const { error } = await supabase.functions.invoke('create-embedding', {
          body: {
            document_name: fileName,
            extracted_text: chunk, // Send one chunk at a time
            user_id: user.id,
            is_chunked: true,
            chunk_index: i,
            total_chunks: textChunks.length,
            metadata: {
              ...metadata,
              pageCount,
              processingMethod: 'client-chunked-processing'
            }
          }
        });

        if (error) {
          throw new Error(`Processing failed on chunk ${i + 1}: ${error.message}`);
        }
      }

      console.log('✅ All document chunks processed successfully');
      return { success: true, chunks_processed: textChunks.length };
      
    } catch (error) {
      console.error('❌ Document processing error:', error);
      throw error;
    }
  },

  // Helper function to split text into chunks
  splitTextIntoChunks(text: string, chunkSize = 1500, chunkOverlap = 100): string[] {
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    if (cleanedText.length <= chunkSize) {
      return [cleanedText];
    }

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < cleanedText.length) {
      let endIndex = Math.min(startIndex + chunkSize, cleanedText.length);

      // If we're not at the end of the text, find the last space to avoid cutting words
      if (endIndex < cleanedText.length) {
        const lastSpace = cleanedText.lastIndexOf(' ', endIndex);
        if (lastSpace > startIndex) {
          endIndex = lastSpace;
        }
      }

      const chunk = cleanedText.slice(startIndex, endIndex).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // Determine the start of the next chunk, considering overlap
      const nextStart = endIndex - chunkOverlap;
      startIndex = Math.max(endIndex, nextStart);
    }

    return chunks;
  },

  async processUploadedFile(file: File): Promise<any> {
    // This function is not used in the current flow, but we'll keep it for now
    throw new Error('File upload processing not implemented in this flow.');
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
