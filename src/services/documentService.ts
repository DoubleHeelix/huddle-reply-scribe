import { encode } from 'gpt-tokenizer';
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

  async processDocumentFromStorage(fileName: string): Promise<{ success: boolean; chunks_processed: number }> {
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

      // 2. Chunk the text on the client using token-aware, structure-first splitting
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

  // Token-aware, structure-first chunking to keep coherent paragraphs/sentences.
  splitTextIntoChunks(text: string, targetTokens = 450, overlapTokens = 60): string[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    type Part = { text: string; tokens: number };
    const chunks: string[] = [];
    const paragraphList = this.splitIntoParagraphs(normalized);
    if (!paragraphList.length) return [normalized];

    let currentParts: Part[] = [];
    let currentTokenCount = 0;

    const flushChunk = (preserveOverlap: boolean) => {
      if (!currentParts.length) return;
      const chunkText = currentParts.map((part) => part.text).join('\n\n');
      chunks.push(chunkText);

      if (preserveOverlap && overlapTokens > 0) {
        let overlapCount = 0;
        const overlapParts: Part[] = [];

        for (let i = currentParts.length - 1; i >= 0 && overlapCount < overlapTokens; i--) {
          overlapParts.unshift(currentParts[i]);
          overlapCount += currentParts[i].tokens;
        }

        currentParts = overlapParts;
        currentTokenCount = overlapCount;
      } else {
        currentParts = [];
        currentTokenCount = 0;
      }
    };

    const addPart = (partText: string) => {
      const tokens = this.countTokens(partText);
      if (tokens === 0) return;

      if (tokens > targetTokens) {
        const smallerPieces = this.splitLongText(partText, targetTokens);
        smallerPieces.forEach((piece) => addPart(piece));
        return;
      }

      if (currentTokenCount + tokens > targetTokens) {
        flushChunk(true);
      }

      currentParts.push({ text: partText, tokens });
      currentTokenCount += tokens;
    };

    paragraphList.forEach((paragraph) => {
      const paragraphTokens = this.countTokens(paragraph);

      if (paragraphTokens > targetTokens) {
        const sentences = this.splitIntoSentences(paragraph);

        if (sentences.length > 1) {
          sentences.forEach((sentence) => {
            const trimmed = sentence.trim();
            if (trimmed) {
              addPart(trimmed);
            }
          });
          return;
        }
      }

      addPart(paragraph);
    });

    flushChunk(false);
    return chunks;
  },

  splitIntoParagraphs(text: string): string[] {
    return text
      .split(/\n\s*\n+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  },

  splitIntoSentences(paragraph: string): string[] {
    return paragraph
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .flatMap((sentence) => sentence.split(/(?<=\.)\s+(?=[•-])/)) // catch bullet-like separators
      .map((sentence) => sentence.trim())
      .filter(Boolean);
  },

  splitLongText(text: string, targetTokens: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (!words.length) return [text];

    const pieces: string[] = [];
    let buffer: string[] = [];
    let bufferTokens = 0;

    const flushBuffer = () => {
      if (!buffer.length) return;
      const combined = buffer.join(' ');
      pieces.push(combined);
      buffer = [];
      bufferTokens = 0;
    };

    words.forEach((word) => {
      const proposed = buffer.length ? `${buffer.join(' ')} ${word}` : word;
      const proposedTokens = this.countTokens(proposed);

      if (proposedTokens > targetTokens && buffer.length) {
        flushBuffer();
      }

      buffer.push(word);
      bufferTokens = this.countTokens(buffer.join(' '));

      if (bufferTokens >= targetTokens) {
        flushBuffer();
      }
    });

    flushBuffer();
    return pieces.length ? pieces : [text];
  },

  countTokens(text: string): number {
    return encode(text).length;
  },

  async processUploadedFile(): Promise<never> {
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
  },

  async deleteAllDocuments(): Promise<void> {
    const { error } = await supabase.functions.invoke('delete-all-documents', {
      method: 'POST',
    });

    if (error) {
      throw new Error(`Failed to delete documents: ${error.message}`);
    }
  }
};
