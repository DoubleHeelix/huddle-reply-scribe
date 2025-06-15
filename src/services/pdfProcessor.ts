
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js to use CDN worker (most reliable approach)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.js';

export interface PDFProcessingResult {
  text: string;
  pageCount: number;
  metadata?: any;
}

export const pdfProcessor = {
  async extractTextFromFile(file: File): Promise<PDFProcessingResult> {
    try {
      console.log('🔄 Starting PDF text extraction using PDF.js...');
      
      const arrayBuffer = await file.arrayBuffer();
      
      console.log('📦 File converted to ArrayBuffer, loading PDF document...');
      
      const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true
      });
      
      const pdf = await loadingTask.promise;
      
      console.log(`📄 PDF loaded successfully: ${pdf.numPages} pages`);
      
      let fullText = '';
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          console.log(`🔍 Processing page ${pageNum}/${pdf.numPages}...`);
          
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Combine text items with spaces
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .trim();
          
          if (pageText) {
            fullText += pageText + '\n\n';
          }
          
          console.log(`✅ Extracted text from page ${pageNum}: ${pageText.length} characters`);
        } catch (pageError) {
          console.warn(`⚠️ Error extracting text from page ${pageNum}:`, pageError);
        }
      }
      
      const cleanedText = fullText
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();
      
      console.log(`✅ PDF text extraction complete: ${cleanedText.length} total characters`);
      
      return {
        text: cleanedText,
        pageCount: pdf.numPages,
        metadata: {
          extractedAt: new Date().toISOString(),
          originalFileName: file.name,
          fileSize: file.size
        }
      };
      
    } catch (error) {
      console.error('❌ PDF text extraction failed:', error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }
};
