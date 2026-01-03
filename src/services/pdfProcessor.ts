
import * as pdfjs from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { supabase } from '@/integrations/supabase/client';

// Set workerSrc to avoid issues with Vite
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

export interface PDFProcessingResult {
  text: string;
  pageCount: number;
  metadata?: Record<string, unknown>;
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
        const items = content.items as TextItem[];

        // Group text by line using pdf.js hasEOL flag and y-position fallback to preserve layout.
        const lines: string[] = [];
        let currentY: number | null = null;
        let buffer: string[] = [];

        const flushLine = () => {
          if (buffer.length) {
            lines.push(buffer.join(' ').trim());
            buffer = [];
          }
        };

        items.forEach((item) => {
          const y = (item as any)?.transform?.[5] as number | undefined;
          const str = (item.str || '').trim();
          if (!str) return;

          if (currentY === null && typeof y === 'number') {
            currentY = y;
          }

          // Prefer pdf.js line hint.
          if ((item as any).hasEOL) {
            buffer.push(str);
            flushLine();
            currentY = typeof y === 'number' ? y : currentY;
            return;
          }

          // Fallback: if y changes enough, assume a new line.
          if (typeof y === 'number' && currentY !== null && Math.abs(y - currentY) > 2) {
            flushLine();
            currentY = y;
          }

          buffer.push(str);
        });

        flushLine();

        // Separate pages with a blank line to avoid run-ons between pages.
        text += lines.join('\n') + '\n\n';
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
      const message = error instanceof Error ? error.message : 'Unknown PDF extraction error';
      throw new Error(`Failed to extract text from PDF: ${message}`);
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
        text += content.items.map((item) => (item as TextItem).str).join(' ');
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
      const message = error instanceof Error ? error.message : 'Unknown PDF extraction error';
      throw new Error(`Failed to extract text from PDF: ${message}`);
    }
  }
};
