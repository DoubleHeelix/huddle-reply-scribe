import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '@/integrations/supabase/client';

// Configure PDF.js worker with multiple fallback CDNs for maximum reliability
const configureWorker = () => {
  // Primary CDN: unpkg (most reliable)
  const primaryWorkerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
  
  // Fallback CDNs, ensuring they use the same version as the library
  const fallbackWorkerSrcs = [
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`,
  ];

  console.log(`🔧 DEBUG: Configuring PDF.js worker with version ${pdfjsLib.version}`);
  console.log(`🔧 DEBUG: Primary worker URL: ${primaryWorkerSrc}`);
  
  // Set the worker source
  pdfjsLib.GlobalWorkerOptions.workerSrc = primaryWorkerSrc;
  
  // Additional configuration to prevent automatic worker loading
  return {
    primaryWorkerSrc,
    fallbackWorkerSrcs
  };
};

// Initialize worker configuration immediately
const workerConfig = configureWorker();

interface ProcessedDocument {
  name: string;
  chunks: string[];
  success: boolean;
  error?: string;
}

class PDFProcessor {
  private async waitForAuth(maxRetries: number = 10, delay: number = 1000): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('✅ DEBUG: User authenticated, proceeding with processing');
        return true;
      }
      console.log(`⏳ DEBUG: Waiting for authentication... attempt ${i + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    console.log('❌ DEBUG: Authentication timeout - user not found after retries');
    return false;
  }

  private async testWorkerAvailability(workerUrl: string): Promise<boolean> {
    try {
      const response = await fetch(workerUrl, { method: 'HEAD' });
      console.log(`🔧 DEBUG: Worker test for ${workerUrl} - Status: ${response.status}`);
      return response.ok;
    } catch (error) {
      console.warn(`⚠️ DEBUG: Worker URL not accessible: ${workerUrl}`, error);
      return false;
    }
  }

  private async extractTextFromPDF(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
    try {
      console.log(`📄 DEBUG: Starting PDF text extraction for: ${fileName}`);
      console.log(`📄 DEBUG: File size: ${arrayBuffer.byteLength} bytes`);

      // Ensure worker is properly configured before processing
      console.log(`🔧 DEBUG: Current worker source: ${pdfjsLib.GlobalWorkerOptions.workerSrc}`);

      // Test primary worker availability
      const isPrimaryWorkerAvailable = await this.testWorkerAvailability(workerConfig.primaryWorkerSrc);
      
      if (!isPrimaryWorkerAvailable) {
        console.log('⚠️ DEBUG: Primary worker not available, trying fallbacks...');
        
        let workerFound = false;
        for (const fallbackUrl of workerConfig.fallbackWorkerSrcs) {
          const isAvailable = await this.testWorkerAvailability(fallbackUrl);
          if (isAvailable) {
            console.log(`✅ DEBUG: Using fallback worker: ${fallbackUrl}`);
            pdfjsLib.GlobalWorkerOptions.workerSrc = fallbackUrl;
            workerFound = true;
            break;
          }
        }
        if (!workerFound) {
            console.error('❌ DEBUG: All primary and fallback PDF workers are unavailable.');
            throw new Error('PDF worker could not be loaded from any CDN. Please check your network connection and try again.');
        }
      }

      // Configure PDF.js with explicit settings to prevent worker issues
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        verbosity: 0,
        // Explicit worker configuration
        isEvalSupported: false,
        disableAutoFetch: true,
        disableStream: true,
        disableRange: true,
        // Force use of our configured worker
        useSystemFonts: true,
        standardFontDataUrl: undefined
      });

      const pdf = await loadingTask.promise;
      console.log(`📄 DEBUG: PDF loaded successfully, ${pdf.numPages} pages`);

      let fullText = '';
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .trim();
          
          if (pageText) {
            fullText += pageText + '\n';
            console.log(`📄 DEBUG: Page ${pageNum} extracted ${pageText.length} characters`);
          }
        } catch (pageError) {
          console.warn(`⚠️ DEBUG: Error processing page ${pageNum}:`, pageError);
          continue;
        }
      }

      const cleanedText = fullText
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();

      console.log(`✅ DEBUG: PDF text extraction completed for ${fileName}, total characters: ${cleanedText.length}`);
      
      if (cleanedText.length === 0) {
        throw new Error('No text content found in PDF - document may contain only images or be password protected');
      }

      return cleanedText;
    } catch (error) {
      console.error(`❌ DEBUG: PDF text extraction failed for ${fileName}:`, error);
      
      // Provide more helpful error messages
      if (error.message.includes('worker')) {
        throw new Error(`PDF worker configuration failed for ${fileName}. This may be due to network connectivity issues or an invalid worker path.`);
      }
      
      throw new Error(`Failed to extract text from ${fileName}: ${error.message}`);
    }
  }

  private chunkText(text: string, maxChunkSize: number = 1000): string[] {
    if (text.length <= maxChunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (currentChunk.length + trimmedSentence.length + 1 <= maxChunkSize) {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + '.');
        }
        currentChunk = trimmedSentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk + '.');
    }

    return chunks.length > 0 ? chunks : [text.substring(0, maxChunkSize)];
  }

  private async createEmbedding(text: string): Promise<number[]> {
    try {
      const { data, error } = await supabase.functions.invoke('create-embedding', {
        body: { text }
      });

      if (error) {
        throw new Error(`Embedding creation failed: ${error.message}`);
      }

      return data.embedding;
    } catch (error) {
      console.error('❌ DEBUG: Error creating embedding:', error);
      throw error;
    }
  }

  private async storeDocumentChunks(docName: string, chunks: string[], userId: string): Promise<void> {
    console.log(`💾 DEBUG: Storing ${chunks.length} chunks for document: ${docName}`);

    // First, delete existing chunks for this document
    const { error: deleteError } = await supabase
      .from('document_knowledge')
      .delete()
      .eq('user_id', userId)
      .eq('document_name', docName);

    if (deleteError) {
      console.warn('⚠️ DEBUG: Error deleting existing chunks:', deleteError);
    }

    // Store new chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        console.log(`💾 DEBUG: Processing chunk ${i + 1}/${chunks.length} for ${docName}`);
        
        const embedding = await this.createEmbedding(chunk);
        
        const { error: insertError } = await supabase
          .from('document_knowledge')
          .insert({
            user_id: userId,
            document_name: docName,
            content_chunk: chunk,
            embedding: JSON.stringify(embedding),
            chunk_index: i,
            metadata: {
              chunk_index: i,
              total_chunks: chunks.length,
              processed_at: new Date().toISOString()
            }
          });

        if (insertError) {
          console.error(`❌ DEBUG: Error inserting chunk ${i + 1}:`, insertError);
          throw insertError;
        }

        console.log(`✅ DEBUG: Successfully stored chunk ${i + 1}/${chunks.length} for ${docName}`);
      } catch (error) {
        console.error(`❌ DEBUG: Error processing chunk ${i + 1} for ${docName}:`, error);
        throw error;
      }
    }

    console.log(`✅ DEBUG: All chunks stored successfully for ${docName}`);
  }

  async processStorageDocuments(bucketName: string): Promise<boolean> {
    try {
      console.log(`🔄 DEBUG: Starting document processing for bucket: ${bucketName}`);

      // Re-configure worker before processing to ensure it's set correctly
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerConfig.primaryWorkerSrc;
      console.log(`🔧 DEBUG: Re-configured worker to: ${pdfjsLib.GlobalWorkerOptions.workerSrc}`);

      // Wait for authentication
      const isAuthenticated = await this.waitForAuth();
      if (!isAuthenticated) {
        throw new Error('User not authenticated');
      }

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user!.id;

      // List files in storage
      const { data: files, error: listError } = await supabase.storage
        .from(bucketName)
        .list('', { limit: 100 });

      if (listError) {
        throw new Error(`Failed to list files: ${listError.message}`);
      }

      const pdfFiles = files?.filter(file => 
        file.name.toLowerCase().endsWith('.pdf') && 
        file.name !== '.emptyFolderPlaceholder'
      ) || [];

      if (pdfFiles.length === 0) {
        console.log('📄 DEBUG: No PDF files found in storage');
        return true;
      }

      console.log(`📄 DEBUG: Found ${pdfFiles.length} PDF files to process`);

      const results: ProcessedDocument[] = [];
      const errors: string[] = [];

      for (const file of pdfFiles) {
        try {
          console.log(`🔄 DEBUG: Processing ${file.name}...`);

          // Download file
          const { data: fileData, error: downloadError } = await supabase.storage
            .from(bucketName)
            .download(file.name);

          if (downloadError) {
            throw new Error(`Failed to download ${file.name}: ${downloadError.message}`);
          }

          // Convert to ArrayBuffer
          const arrayBuffer = await fileData.arrayBuffer();

          // Extract text
          const text = await this.extractTextFromPDF(arrayBuffer, file.name);
          
          // Create chunks
          const chunks = this.chunkText(text);
          console.log(`📄 DEBUG: Created ${chunks.length} chunks for ${file.name}`);

          // Store in database
          const docName = file.name.replace('.pdf', '');
          await this.storeDocumentChunks(docName, chunks, userId);

          results.push({
            name: file.name,
            chunks,
            success: true
          });

          console.log(`✅ DEBUG: Successfully processed ${file.name}`);

        } catch (error) {
          console.error(`❌ DEBUG: Error processing ${file.name}:`, error);
          const errorMessage = `Error processing ${file.name}: ${error.message}`;
          errors.push(errorMessage);
          results.push({
            name: file.name,
            chunks: [],
            success: false,
            error: errorMessage
          });
        }
      }

      // Log summary
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      console.log(`📊 DEBUG: Processing complete - ${successful} successful, ${failed} failed`);

      if (errors.length > 0) {
        console.log('❌ DEBUG: Errors encountered:', errors);
        throw new Error(`Some documents failed to process: ${errors.join(', ')}`);
      }

      return true;

    } catch (error) {
      console.error('❌ DEBUG: Error in processStorageDocuments:', error);
      throw error;
    }
  }
}

export const pdfProcessor = new PDFProcessor();
