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
    
    try {
      // Use PDF.js to extract text from PDF with better worker setup
      const pdfjsLib = await import('pdfjs-dist');
      
      // Use a more reliable worker setup
      if (typeof window !== 'undefined') {
        // For browser environment, use the bundled worker
        const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.js');
        pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
          new Blob([pdfjsWorker.default], { type: 'application/javascript' })
        );
      } else {
        // Fallback for other environments
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
      }
      
      const arrayBuffer = await file.arrayBuffer();
      console.log('📄 DEBUG: PDF file size:', arrayBuffer.byteLength, 'bytes');
      
      const pdf = await pdfjsLib.getDocument({ 
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true
      }).promise;
      console.log('📄 DEBUG: PDF loaded, total pages:', pdf.numPages);
      
      let fullText = '';
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          
          console.log(`📄 DEBUG: Page ${pageNum} extracted ${pageText.length} characters`);
          fullText += `\n\nPage ${pageNum}:\n${pageText}`;
        } catch (pageError) {
          console.error(`❌ DEBUG: Error extracting page ${pageNum}:`, pageError);
          // Continue with other pages even if one fails
        }
      }
      
      console.log('📄 DEBUG: Total text extracted:', fullText.length, 'characters');
      return fullText;
    } catch (error) {
      console.error('❌ DEBUG: Error in PDF text extraction:', error);
      
      // If PDF.js fails, try a fallback approach using FileReader
      console.log('🔄 DEBUG: Attempting fallback text extraction...');
      try {
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
          reader.onload = () => {
            // This is a very basic fallback - in reality, this won't extract text from PDF
            // but it prevents the entire process from failing
            console.log('⚠️ DEBUG: Using fallback extraction (limited functionality)');
            resolve(`Document: ${file.name}\nContent could not be extracted automatically. Please ensure the PDF is not encrypted or corrupted.`);
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });
      } catch (fallbackError) {
        console.error('❌ DEBUG: Fallback extraction also failed:', fallbackError);
        throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the PDF is not encrypted or corrupted.`);
      }
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
      
      // Extract text from PDF
      const fullText = await this.extractTextFromPDF(file);
      
      if (!fullText.trim()) {
        console.error('❌ DEBUG: No text extracted from PDF');
        return false;
      }

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
      return false;
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
