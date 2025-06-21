// OCR Service using Google Cloud Vision API via Supabase Edge Function
import { supabase } from "@/integrations/supabase/client";

export interface OCRResult {
  text: string;
  processingTime: number;
  success: boolean;
  error?: string;
}

interface OCRConfig {
  enableAutoCorpping?: boolean;
  margin?: number;
}

export class OCRService {
  private config: OCRConfig;

  constructor(config: OCRConfig = {}) {
    this.config = {
      enableAutoCorpping: true,
      margin: 12,
      ...config
    };
  }

  async extractTextFromImage(imageInput: string | Uint8Array | File): Promise<OCRResult> {
    const startTime = performance.now();
    console.log(`OCR: Starting text extraction. Input type: ${typeof imageInput}`);

    try {
      let imageDataUrl: string;
      
      // Handle different input types
      if (typeof imageInput === 'string') {
        // Already a data URL or base64
        imageDataUrl = imageInput;
        console.log(`OCR: Using string input as data URL`);
      } else if (imageInput instanceof File) {
        // Convert File to data URL
        imageDataUrl = await this.fileToDataUrl(imageInput);
        console.log(`OCR: Converted file ${imageInput.name} to data URL`);
      } else if (imageInput instanceof Uint8Array) {
        // Convert Uint8Array to data URL
        imageDataUrl = await this.uint8ArrayToDataUrl(imageInput);
        console.log(`OCR: Converted Uint8Array to data URL`);
      } else {
        throw new Error(`Invalid input type for OCR. Expected data URL, File, or Uint8Array. Got ${typeof imageInput}.`);
      }

      // Auto-crop if enabled and not on mobile
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      if (this.config.enableAutoCorpping && !isMobile) {
        try {
          imageDataUrl = await this.autoCropChatArea(imageDataUrl, this.config.margin || 12);
          console.log('OCR: Auto-cropping completed');
        } catch (cropError) {
          console.warn('OCR: Auto-crop failed, using original image:', cropError);
        }
      }

      // Convert to base64
      const base64Image = imageDataUrl.split(',')[1];

      // Call Supabase edge function for OCR processing
      console.log('OCR: Calling Supabase edge function...');
      const { data, error } = await supabase.functions.invoke('ocr-extract', {
        body: {
          imageData: base64Image,
          enableAutoCropping: this.config.enableAutoCorpping,
          margin: this.config.margin
        }
      });

      if (error) {
        console.error('OCR: Supabase function error:', error);
        throw new Error(`OCR processing failed: ${error.message}`);
      }

      const endTime = performance.now();
      const totalProcessingTime = (endTime - startTime) / 1000;
      
      console.log(`OCR: Total processing completed in ${totalProcessingTime.toFixed(2)} seconds.`);

      return {
        text: data.text || '',
        processingTime: totalProcessingTime,
        success: data.success || false,
        error: data.error
      };

    } catch (error) {
      const endTime = performance.now();
      const processingTime = (endTime - startTime) / 1000;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`OCR Error: Unexpected exception during processing (took ${processingTime.toFixed(2)}s):`, error);
      
      return {
        text: '',
        processingTime,
        success: false,
        error: errorMessage
      };
    }
  }

  private async fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async uint8ArrayToDataUrl(uint8Array: Uint8Array): Promise<string> {
    const blob = new Blob([uint8Array]);
    return this.fileToDataUrl(new File([blob], 'image.jpg', { type: 'image/jpeg' }));
  }

  private async autoCropChatArea(imageDataUrl: string, margin: number = 12): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        const img = new Image();
        
        img.onload = () => {
          try {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            // Get image data for analysis
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            const data = imageData.data;

            // Convert to grayscale and find content boundaries
            const contentMask: boolean[][] = [];
            for (let y = 0; y < img.height; y++) {
              contentMask[y] = [];
              for (let x = 0; x < img.width; x++) {
                const idx = (y * img.width + x) * 4;
                const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                contentMask[y][x] = gray < 230; // Pixels darker than near-white
              }
            }

            // Find content boundaries
            const rowsContent = contentMask.map(row => row.filter(Boolean).length);
            const colsContent: number[] = [];
            for (let x = 0; x < img.width; x++) {
              let count = 0;
              for (let y = 0; y < img.height; y++) {
                if (contentMask[y][x]) count++;
              }
              colsContent[x] = count;
            }

            const firstTrue = (arr: number[]) => arr.findIndex(val => val > 5);
            const lastTrue = (arr: number[]) => {
              for (let i = arr.length - 1; i >= 0; i--) {
                if (arr[i] > 5) return i;
              }
              return -1;
            };

            let top = firstTrue(rowsContent);
            let bottom = lastTrue(rowsContent);
            let left = firstTrue(colsContent);
            let right = lastTrue(colsContent);

            // Add margin and clamp to image size
            top = Math.max(0, top - margin);
            left = Math.max(0, left - margin);
            bottom = Math.min(img.height - 1, bottom + margin);
            right = Math.min(img.width - 1, right + margin);

            // Check for invalid crop box
            if (top >= bottom || left >= right) {
              console.warn('Auto-crop Warning: Invalid crop box calculated, returning original image.');
              resolve(imageDataUrl);
              return;
            }

            // Create cropped canvas
            const croppedCanvas = document.createElement('canvas');
            const croppedCtx = croppedCanvas.getContext('2d');
            if (!croppedCtx) {
              throw new Error('Could not get cropped canvas context');
            }

            const cropWidth = right - left;
            const cropHeight = bottom - top;
            croppedCanvas.width = cropWidth;
            croppedCanvas.height = cropHeight;

            croppedCtx.drawImage(img, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

            // Convert back to data URL
            const croppedDataUrl = croppedCanvas.toDataURL('image/jpeg', 0.9);
            resolve(croppedDataUrl);

          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () => {
          reject(new Error('Failed to load image for auto-cropping'));
        };

        img.src = imageDataUrl;

      } catch (error) {
        reject(error);
      }
    });
  }

  // Configuration methods
  setGoogleCloudApiKey(apiKey: string) {
    // No longer needed as we use Supabase secrets
    console.log('OCR: Google Cloud API key is now managed via Supabase secrets');
  }

  setAutoCroppingEnabled(enabled: boolean) {
    this.config.enableAutoCorpping = enabled;
  }

  setAutoCropMargin(margin: number) {
    this.config.margin = margin;
  }
}

// Export singleton instance
export const ocrService = new OCRService();

// Utility function for quick OCR
export const extractTextFromImage = async (imageInput: string | Uint8Array | File): Promise<string> => {
  const result = await ocrService.extractTextFromImage(imageInput);
  if (!result.success && result.error) {
    console.error('OCR failed:', result.error);
  }
  return result.text;
};
