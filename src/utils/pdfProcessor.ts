import { supabase } from '@/integrations/supabase/client';

export interface DocumentChunk {
  content: string;
  chunkIndex: number;
  metadata: {
    page?: number;
    section?: string;
    keywords?: string[];
  };
}

export class PDFProcessor {
  private async extractTextFromPDF(file: File): Promise<string> {
    console.log('📄 DEBUG: Starting PDF text extraction for:', file.name);
    console.log('📄 DEBUG: File size:', file.size, 'bytes');
    console.log('📄 DEBUG: File type:', file.type);
    
    try {
      // Dynamic import of PDF.js
      const pdfjsLib = await import('pdfjs-dist');
      console.log('📄 DEBUG: PDF.js loaded, version:', pdfjsLib.version);
      
      // Configure worker for browser environment
      if (typeof window !== 'undefined') {
        // Disable worker to avoid loading issues
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';
        console.log('📄 DEBUG: Disabled PDF.js worker for browser compatibility');
      }
      
      const arrayBuffer = await file.arrayBuffer();
      console.log('📄 DEBUG: Array buffer created, size:', arrayBuffer.byteLength);
      
      if (arrayBuffer.byteLength === 0) {
        throw new Error('PDF file is empty or corrupted');
      }
      
      // Load PDF with minimal configuration to avoid worker issues
      let pdf;
      try {
        console.log('📄 DEBUG: Loading PDF with minimal config...');
        pdf = await pdfjsLib.getDocument({ 
          data: arrayBuffer,
          verbosity: 0,
          disableAutoFetch: false,
          disableStream: false,
          disableRange: false
        }).promise;
        console.log('📄 DEBUG: PDF loaded successfully');
      } catch (loadError) {
        console.log('📄 DEBUG: Standard loading failed, trying fallback...', loadError);
        
        // Fallback: even more minimal config
        pdf = await pdfjsLib.getDocument({ 
          data: arrayBuffer,
          verbosity: 0
        }).promise;
        console.log('📄 DEBUG: PDF loaded with fallback config');
      }
      
      console.log('📄 DEBUG: PDF loaded successfully, total pages:', pdf.numPages);
      
      if (pdf.numPages === 0) {
        throw new Error('PDF has no pages');
      }
      
      let fullText = '';
      let extractedPages = 0;
      let totalTextItems = 0;
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          console.log(`📄 DEBUG: Processing page ${pageNum}/${pdf.numPages}`);
          const page = await pdf.getPage(pageNum);
          
          // Get text content with simple extraction
          const textContent = await page.getTextContent({
            normalizeWhitespace: true
          });
          
          console.log(`📄 DEBUG: Page ${pageNum} - Text content extracted, items:`, textContent.items.length);
          
          if (textContent && textContent.items && textContent.items.length > 0) {
            // Extract text with better filtering
            const pageTextItems = textContent.items
              .filter((item: any) => {
                return item && 
                       typeof item.str === 'string' && 
                       item.str.trim().length > 0 &&
                       item.str.trim() !== ' ';
              })
              .map((item: any) => item.str.trim())
              .filter(str => str.length > 0);
            
            totalTextItems += pageTextItems.length;
            console.log(`📄 DEBUG: Page ${pageNum} - Filtered text items:`, pageTextItems.length);
            
            if (pageTextItems.length > 0) {
              const pageText = pageTextItems
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
              
              if (pageText.length > 0) {
                console.log(`📄 DEBUG: Page ${pageNum} - Extracted ${pageText.length} characters`);
                console.log(`📄 DEBUG: Page ${pageNum} - Sample text:`, pageText.substring(0, 200) + '...');
                fullText += `${pageText} `;
                extractedPages++;
              }
            }
          } else {
            console.log(`📄 DEBUG: Page ${pageNum} - No text items found`);
          }
          
          // Clean up page resources
          page.cleanup();
        } catch (pageError) {
          console.error(`❌ DEBUG: Error extracting page ${pageNum}:`, pageError);
          // Continue with other pages
        }
      }
      
      // Clean up PDF document
      pdf.destroy();
      
      console.log(`📄 DEBUG: Extraction complete:`, {
        totalPages: pdf.numPages,
        extractedPages,
        totalTextItems,
        finalTextLength: fullText.length,
        sampleText: fullText.substring(0, 300) + '...'
      });
      
      // More detailed validation
      const trimmedText = fullText.trim();
      if (trimmedText.length < 10) {
        if (totalTextItems === 0) {
          throw new Error(`No text content found in PDF. This PDF may be image-based (scanned document), password-protected, or use unsupported encoding.`);
        } else {
          throw new Error(`PDF contains only ${trimmedText.length} characters of readable text. The document may be mostly images or have formatting issues.`);
        }
      }
      
      console.log('✅ DEBUG: Text extraction successful!');
      return trimmedText;
      
    } catch (error) {
      console.error('❌ DEBUG: PDF text extraction failed:', error);
      
      // Provide more specific error information
      if (error.message.includes('Invalid PDF')) {
        throw new Error(`The uploaded file is not a valid PDF or is corrupted. Please check the file and try again.`);
      } else if (error.message.includes('password')) {
        throw new Error(`This PDF is password-protected. Please provide an unprotected version.`);
      }
      
      // Re-throw with original error for debugging
      throw error;
    }
  }

  private chunkText(text: string, chunkSize: number = 1000): DocumentChunk[] {
    console.log('✂️ DEBUG: Starting text chunking, target size:', chunkSize);
    
    const chunks: DocumentChunk[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    console.log('✂️ DEBUG: Split into', sentences.length, 'sentences');
    
    let currentChunk = '';
    let chunkIndex = 0;
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        const keywords = this.extractKeywords(currentChunk);
        chunks.push({
          content: currentChunk.trim(),
          chunkIndex,
          metadata: {
            keywords
          }
        });
        console.log(`✂️ DEBUG: Created chunk ${chunkIndex}, size: ${currentChunk.length} chars, keywords: ${keywords.length}`);
        currentChunk = sentence;
        chunkIndex++;
      } else {
        currentChunk += sentence + '. ';
      }
    }
    
    if (currentChunk.trim().length > 0) {
      const keywords = this.extractKeywords(currentChunk);
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex,
        metadata: {
          keywords
        }
      });
      console.log(`✂️ DEBUG: Created final chunk ${chunkIndex}, size: ${currentChunk.length} chars`);
    }
    
    console.log('✂️ DEBUG: Total chunks created:', chunks.length);
    return chunks;
  }

  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const stopWords = new Set(['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'said', 'each', 'which', 'their', 'time', 'would', 'about', 'there', 'could', 'other', 'more', 'very', 'what', 'know', 'just', 'first', 'into', 'over', 'think', 'also', 'your', 'work', 'life', 'only', 'can', 'still', 'should', 'after', 'being', 'now', 'made', 'before', 'here', 'through', 'when', 'where', 'much', 'same', 'than', 'many', 'well', 'such']);
    
    const filteredWords = words.filter(word => !stopWords.has(word));
    
    // Count frequency and return top keywords
    const wordCount: { [key: string]: number } = {};
    filteredWords.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private async createEmbedding(text: string): Promise<number[]> {
    try {
      console.log('🧠 DEBUG: Creating embedding for text chunk, length:', text.length);
      
      const { data, error } = await supabase.functions.invoke('create-embedding', {
        body: { text }
      });

      if (error) {
        console.error('❌ DEBUG: Error creating embedding:', error);
        return [];
      }

      console.log('✅ DEBUG: Embedding created successfully, dimensions:', data.embedding?.length);
      return data.embedding;
    } catch (error) {
      console.error('❌ DEBUG: Error calling embedding function:', error);
      return [];
    }
  }

  async processDocument(file: File, documentName: string): Promise<boolean> {
    try {
      console.log(`🔄 DEBUG: Starting to process document: ${documentName}`);
      console.log(`📄 DEBUG: File details:`, {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: new Date(file.lastModified).toISOString()
      });
      
      // Extract text from PDF - this will throw descriptive errors if extraction fails
      const fullText = await this.extractTextFromPDF(file);
      
      console.log(`✅ DEBUG: Successfully extracted ${fullText.length} characters from ${documentName}`);

      // Chunk the text
      const chunks = this.chunkText(fullText);
      console.log(`✂️ DEBUG: Document chunked into ${chunks.length} pieces`);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ DEBUG: User not authenticated');
        return false;
      }

      console.log('👤 DEBUG: Processing chunks for user:', user.id);

      // First, delete any existing chunks for this document to avoid duplicates
      const { error: deleteError } = await supabase
        .from('document_knowledge')
        .delete()
        .eq('user_id', user.id)
        .eq('document_name', documentName);

      if (deleteError) {
        console.error('❌ DEBUG: Error deleting existing chunks:', deleteError);
      } else {
        console.log('🗑️ DEBUG: Cleaned up existing chunks for', documentName);
      }

      // Process each chunk
      let successfulChunks = 0;
      for (const chunk of chunks) {
        console.log(`🔄 DEBUG: Processing chunk ${chunk.chunkIndex + 1}/${chunks.length}`);
        
        const embedding = await this.createEmbedding(chunk.content);
        
        const { error } = await supabase
          .from('document_knowledge')
          .insert({
            user_id: user.id,
            document_name: documentName,
            document_type: 'pdf',
            content_chunk: chunk.content,
            chunk_index: chunk.chunkIndex,
            embedding: embedding.length > 0 ? JSON.stringify(embedding) : null,
            metadata: chunk.metadata
          });

        if (error) {
          console.error(`❌ DEBUG: Error storing chunk ${chunk.chunkIndex}:`, error);
        } else {
          successfulChunks++;
          console.log(`✅ DEBUG: Successfully stored chunk ${chunk.chunkIndex + 1}`);
        }
      }

      console.log(`✅ DEBUG: Document processing complete: ${successfulChunks}/${chunks.length} chunks stored successfully`);
      return successfulChunks > 0;
    } catch (error) {
      console.error('❌ DEBUG: Error processing document:', error);
      // Don't return false immediately - let the user know what went wrong
      throw error;
    }
  }

  async processStorageDocuments(bucketName: string = 'documents'): Promise<void> {
    try {
      console.log('📁 DEBUG: Starting to process documents from Supabase Storage bucket:', bucketName);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ DEBUG: User not authenticated');
        throw new Error('User not authenticated');
      }

      console.log('👤 DEBUG: User authenticated:', user.id);

      // List files in the storage bucket with better error handling
      console.log('📁 DEBUG: Listing files in storage bucket...');
      const { data: files, error: listError } = await supabase.storage
        .from(bucketName)
        .list('', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (listError) {
        console.error('❌ DEBUG: Error listing files:', listError);
        throw new Error(`Failed to list files from storage: ${listError.message}`);
      }

      if (!files || files.length === 0) {
        console.log('⚠️ DEBUG: No files found in storage bucket');
        throw new Error('No files found in storage bucket. Please upload PDF files first.');
      }

      console.log(`📁 DEBUG: Found ${files.length} files in storage:`, files.map(f => f.name));

      // Filter for PDF files
      const pdfFiles = files.filter(file => 
        file.name.toLowerCase().endsWith('.pdf') && 
        !file.name.startsWith('.') &&
        file.name !== '.emptyFolderPlaceholder'
      );

      console.log(`📄 DEBUG: Found ${pdfFiles.length} PDF files to process:`, pdfFiles.map(f => f.name));

      if (pdfFiles.length === 0) {
        throw new Error('No PDF files found in storage bucket. Please upload PDF files first.');
      }

      let processedCount = 0;
      const errors: string[] = [];

      for (const fileInfo of pdfFiles) {
        try {
          const documentName = fileInfo.name.replace('.pdf', '');
          console.log(`🔍 DEBUG: Checking if ${fileInfo.name} already processed...`);
          
          // Check if this document has already been processed
          const { data: existingDocs } = await supabase
            .from('document_knowledge')
            .select('id')
            .eq('user_id', user.id)
            .eq('document_name', documentName)
            .limit(1);

          if (existingDocs && existingDocs.length > 0) {
            console.log(`⏭️ DEBUG: Document ${fileInfo.name} already processed, skipping...`);
            continue;
          }

          console.log(`⬇️ DEBUG: Downloading ${fileInfo.name} from storage...`);
          
          // Download the file from storage
          const { data: fileData, error: downloadError } = await supabase.storage
            .from(bucketName)
            .download(fileInfo.name);

          if (downloadError) {
            console.error(`❌ DEBUG: Error downloading ${fileInfo.name}:`, downloadError);
            errors.push(`Failed to download ${fileInfo.name}: ${downloadError.message}`);
            continue;
          }

          console.log(`✅ DEBUG: Successfully downloaded ${fileInfo.name}, size: ${fileData.size} bytes`);

          // Convert blob to File object
          const file = new File([fileData], fileInfo.name, { type: 'application/pdf' });
          
          // Process the document
          console.log(`🔄 DEBUG: Starting processing of ${documentName}...`);
          
          const success = await this.processDocument(file, documentName);
          
          if (success) {
            console.log(`✅ DEBUG: Successfully processed ${fileInfo.name} from storage`);
            processedCount++;
          } else {
            console.log(`❌ DEBUG: Failed to process ${fileInfo.name}`);
            errors.push(`Failed to process ${fileInfo.name}`);
          }
        } catch (error) {
          console.error(`❌ DEBUG: Error processing ${fileInfo.name}:`, error);
          errors.push(`Error processing ${fileInfo.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      console.log(`🎉 DEBUG: Finished processing documents. Successfully processed: ${processedCount}/${pdfFiles.length}`);
      
      if (errors.length > 0) {
        console.error('❌ DEBUG: Errors encountered:', errors);
        throw new Error(`Some documents failed to process: ${errors.join(', ')}`);
      }
      
      if (processedCount === 0) {
        throw new Error('No new documents were processed. All documents may have been processed already.');
      }
    } catch (error) {
      console.error('❌ DEBUG: Error in processStorageDocuments:', error);
      throw error;
    }
  }

  // Keep the old method for backwards compatibility
  async processExistingDocuments(): Promise<void> {
    console.log('🔄 DEBUG: processExistingDocuments called - redirecting to storage...');
    await this.processStorageDocuments();
  }
}

export const pdfProcessor = new PDFProcessor();
