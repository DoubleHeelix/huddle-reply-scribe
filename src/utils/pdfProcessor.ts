
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
    // Use PDF.js to extract text from PDF
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += `\n\nPage ${pageNum}:\n${pageText}`;
    }
    
    return fullText;
  }

  private chunkText(text: string, chunkSize: number = 1000): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    let chunkIndex = 0;
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.trim(),
          chunkIndex,
          metadata: {
            keywords: this.extractKeywords(currentChunk)
          }
        });
        currentChunk = sentence;
        chunkIndex++;
      } else {
        currentChunk += sentence + '. ';
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex,
        metadata: {
          keywords: this.extractKeywords(currentChunk)
        }
      });
    }
    
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
      const { data, error } = await supabase.functions.invoke('create-embedding', {
        body: { text }
      });

      if (error) {
        console.error('Error creating embedding:', error);
        return [];
      }

      return data.embedding;
    } catch (error) {
      console.error('Error calling embedding function:', error);
      return [];
    }
  }

  async processDocument(file: File, documentName: string): Promise<boolean> {
    try {
      console.log(`Processing document: ${documentName}`);
      
      // Extract text from PDF
      const fullText = await this.extractTextFromPDF(file);
      
      if (!fullText.trim()) {
        console.error('No text extracted from PDF');
        return false;
      }

      // Chunk the text
      const chunks = this.chunkText(fullText);
      console.log(`Created ${chunks.length} chunks for ${documentName}`);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated');
        return false;
      }

      // Process each chunk
      let successCount = 0;
      for (const chunk of chunks) {
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
          console.error('Error storing chunk:', error);
        } else {
          successCount++;
        }
      }

      console.log(`Successfully processed ${successCount}/${chunks.length} chunks for ${documentName}`);
      return successCount > 0;
    } catch (error) {
      console.error('Error processing document:', error);
      return false;
    }
  }

  async processExistingDocuments(): Promise<void> {
    const documents = [
      { path: '/src/Docs/DTM.pdf', name: 'DTM' },
      { path: '/src/Docs/FAQ.pdf', name: 'FAQ' },
      { path: '/src/Docs/MPA.pdf', name: 'MPA' },
      { path: '/src/Docs/OLB.pdf', name: 'OLB' }
    ];

    console.log('Starting to process all documents...');
    let processedCount = 0;

    for (const doc of documents) {
      try {
        console.log(`Fetching document: ${doc.path}`);
        const response = await fetch(doc.path);
        
        if (!response.ok) {
          console.error(`Failed to fetch ${doc.name}: ${response.status} ${response.statusText}`);
          continue;
        }
        
        const blob = await response.blob();
        const file = new File([blob], `${doc.name}.pdf`, { type: 'application/pdf' });
        
        console.log(`Processing ${doc.name}...`);
        const success = await this.processDocument(file, doc.name);
        
        if (success) {
          processedCount++;
          console.log(`✓ Successfully processed ${doc.name}`);
        } else {
          console.error(`✗ Failed to process ${doc.name}`);
        }
      } catch (error) {
        console.error(`Error processing ${doc.name}:`, error);
      }
    }

    console.log(`Document processing complete: ${processedCount}/${documents.length} documents processed successfully`);
  }
}

export const pdfProcessor = new PDFProcessor();
