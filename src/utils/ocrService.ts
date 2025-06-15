
// OCR Service using Google Cloud Vision API
// Note: In a production environment, this should be handled server-side
// For demo purposes, we'll create the structure and use a placeholder

export interface OCRResult {
  text: string;
  processingTime: number;
  success: boolean;
  error?: string;
}

interface OCRConfig {
  googleCloudApiKey?: string;
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
      let imageBytes: Uint8Array;
      
      // Handle different input types
      if (typeof imageInput === 'string') {
        // Base64 string or data URL
        if (imageInput.startsWith('data:')) {
          const base64Data = imageInput.split(',')[1];
          imageBytes = this.base64ToUint8Array(base64Data);
        } else {
          throw new Error('String input must be a data URL');
        }
        console.log(`OCR: Successfully processed data URL, got ${imageBytes.length} bytes`);
      } else if (imageInput instanceof File) {
        imageBytes = new Uint8Array(await imageInput.arrayBuffer());
        console.log(`OCR: Successfully read ${imageBytes.length} bytes from file: ${imageInput.name}`);
      } else if (imageInput instanceof Uint8Array) {
        imageBytes = imageInput;
        console.log(`OCR: Received ${imageBytes.length} bytes directly.`);
      } else {
        throw new Error(`Invalid input type for OCR. Expected data URL, File, or Uint8Array. Got ${typeof imageInput}.`);
      }

      if (!imageBytes || imageBytes.length === 0) {
        throw new Error('Image content is empty or could not be loaded.');
      }

      // Auto-crop if enabled
      if (this.config.enableAutoCorpping) {
        try {
          imageBytes = await this.autoCropChatArea(imageBytes, this.config.margin || 12);
        } catch (cropError) {
          console.warn('Auto-crop failed, using original image:', cropError);
        }
      }

      // In a real implementation, this would call Google Cloud Vision API
      // For now, we'll simulate the OCR process
      const extractedText = await this.performOCR(imageBytes);

      const endTime = performance.now();
      const processingTime = (endTime - startTime) / 1000;
      console.log(`OCR: Processing completed in ${processingTime.toFixed(2)} seconds.`);

      return {
        text: extractedText.trim(),
        processingTime,
        success: true
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

  private async performOCR(imageBytes: Uint8Array): Promise<string> {
    // In a real implementation, this would make an API call to Google Cloud Vision
    // For demo purposes, we'll return a placeholder message
    
    if (!this.config.googleCloudApiKey) {
      return "OCR functionality requires Google Cloud Vision API key. Please configure your API credentials.";
    }

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // TODO: Implement actual Google Cloud Vision API call
    // This would involve:
    // 1. Converting imageBytes to base64
    // 2. Making POST request to Google Cloud Vision API
    // 3. Parsing the response and extracting text
    
    return "Please describe what you see in the screenshot or the conversation context that's relevant to your draft message.";
  }

  private async autoCropChatArea(imageBytes: Uint8Array, margin: number = 12): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      try {
        // Create canvas and load image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        const img = new Image();
        const blob = new Blob([imageBytes]);
        const url = URL.createObjectURL(blob);

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
              URL.revokeObjectURL(url);
              resolve(imageBytes);
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

            // Convert back to bytes
            croppedCanvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob from cropped canvas'));
                return;
              }
              
              blob.arrayBuffer().then(buffer => {
                URL.revokeObjectURL(url);
                resolve(new Uint8Array(buffer));
              }).catch(reject);
            }, 'image/jpeg', 0.9);

          } catch (error) {
            URL.revokeObjectURL(url);
            reject(error);
          }
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load image for auto-cropping'));
        };

        img.src = url;

      } catch (error) {
        reject(error);
      }
    });
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Configuration methods
  setGoogleCloudApiKey(apiKey: string) {
    this.config.googleCloudApiKey = apiKey;
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
