export interface Story {
  id: string;          // Unique identifier (e.g., timestamp + filename)
  file: File;          // The original image file
  previewUrl: string;  // Data URL for image preview
  ocrText?: string;      // Extracted text from OCR
  interruptions: string[]; // Generated interruption messages
  status: 'pending' | 'uploading' | 'ocr' | 'generating' | 'completed' | 'error';
  error?: string;        // Error message if something fails
}