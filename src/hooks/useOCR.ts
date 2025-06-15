
import { useState, useCallback } from 'react';
import { ocrService, type OCRResult } from '@/utils/ocrService';

interface UseOCROptions {
  googleCloudApiKey?: string;
  enableAutoCropping?: boolean;
  autoCropMargin?: number;
}

export const useOCR = (options: UseOCROptions = {}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Configure OCR service with provided options
  const configureOCR = useCallback(() => {
    if (options.googleCloudApiKey) {
      ocrService.setGoogleCloudApiKey(options.googleCloudApiKey);
    }
    if (options.enableAutoCropping !== undefined) {
      ocrService.setAutoCroppingEnabled(options.enableAutoCropping);
    }
    if (options.autoCropMargin !== undefined) {
      ocrService.setAutoCropMargin(options.autoCropMargin);
    }
  }, [options]);

  const extractText = useCallback(async (imageInput: string | Uint8Array | File): Promise<string> => {
    setIsProcessing(true);
    setError(null);
    
    try {
      configureOCR();
      const result = await ocrService.extractTextFromImage(imageInput);
      setLastResult(result);
      
      if (!result.success) {
        setError(result.error || 'OCR processing failed');
        return '';
      }
      
      return result.text;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown OCR error';
      setError(errorMessage);
      console.error('OCR Error in hook:', err);
      return '';
    } finally {
      setIsProcessing(false);
    }
  }, [configureOCR]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearResults = useCallback(() => {
    setLastResult(null);
    setError(null);
  }, []);

  return {
    extractText,
    isProcessing,
    lastResult,
    error,
    clearError,
    clearResults,
    // Expose configuration methods
    setGoogleCloudApiKey: (key: string) => ocrService.setGoogleCloudApiKey(key),
    setAutoCroppingEnabled: (enabled: boolean) => ocrService.setAutoCroppingEnabled(enabled),
    setAutoCropMargin: (margin: number) => ocrService.setAutoCropMargin(margin)
  };
};
