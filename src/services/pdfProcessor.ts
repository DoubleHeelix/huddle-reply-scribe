
import * as pdfjs from 'pdfjs-dist';
import { supabase } from '@/integrations/supabase/client';

// Set workerSrc to avoid issues with Vite
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

export interface PDFProcessingResult {
  text: string;
  pageCount: number;
  metadata?: any;
}

export const pdfProcessor = {
  async extractTextFromFile(file: File): Promise<PDFProcessingResult> {
    try {
      console.log('🔄 Starting PDF text extraction from file...');
      const arrayBuffer = await file.arrayBuffer();
      const doc = await pdfjs.getDocument(arrayBuffer).promise;
      let text = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ');
      }
      console.log(`✅ PDF processing complete: ${text.length} characters`);
      return {
        text,
        pageCount: doc.numPages,
        metadata: {
          extractedAt: new Date().toISOString(),
          originalFileName: file.name,
          fileSize: file.size,
          processingMethod: 'pdfjs-dist'
        }
      };
    } catch (error) {
      console.error('❌ PDF text extraction failed:', error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  },

  async extractTextFromStorage(fileName: string): Promise<PDFProcessingResult> {
    try {
      console.log('🔄 Starting PDF extraction from storage...');
      const { data, error } = await supabase.storage.from('documents').download(fileName);
      if (error) throw error;
      const arrayBuffer = await data.arrayBuffer();
      const doc = await pdfjs.getDocument(arrayBuffer).promise;
      let text = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ');
      }
      console.log(`✅ PDF extraction complete: ${text.length} characters`);
      return {
        text,
        pageCount: doc.numPages,
        metadata: {
          extractedAt: new Date().toISOString(),
          originalFileName: fileName,
          processingMethod: 'pdfjs-dist'
        }
      };
    } catch (error) {
      console.error('❌ PDF extraction failed:', error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }
};
