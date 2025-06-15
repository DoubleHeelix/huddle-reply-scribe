
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface UploadResult {
  success: boolean;
  message: string;
  chunks?: number;
  totalTextLength?: number;
}

export const PDFUploader = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const { toast } = useToast();

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: 'Invalid File Type',
        description: 'Please select a PDF file.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: 'File Too Large',
        description: 'Please select a PDF file smaller than 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      // Convert file to base64
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1]; // Remove data:application/pdf;base64, prefix
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Process PDF through Edge Function
      const { data, error } = await supabase.functions.invoke('process-pdf', {
        body: {
          fileName: file.name,
          fileContent: fileContent
        },
      });

      if (error) {
        throw new Error(`Processing failed: ${error.message}`);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setUploadResult(data);
      toast({
        title: 'PDF Processed Successfully',
        description: data.message,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process PDF';
      console.error('PDF upload error:', err);
      setUploadResult({
        success: false,
        message: errorMessage
      });
      toast({
        title: 'Upload Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  }, [toast]);

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Upload PDF Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-lg p-6 hover:border-gray-500 transition-colors">
          <Upload className="w-8 h-8 text-gray-400 mb-2" />
          <p className="text-gray-300 text-sm text-center mb-4">
            Upload PDF documents to enhance AI suggestions with your knowledge base
          </p>
          <Button
            variant="outline"
            disabled={isUploading}
            className="relative bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
          >
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isUploading}
            />
            {isUploading ? 'Processing...' : 'Choose PDF File'}
          </Button>
        </div>

        {isUploading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400 mr-3"></div>
            <span className="text-gray-300">Processing PDF and creating embeddings...</span>
          </div>
        )}

        {uploadResult && (
          <div className={`flex items-start gap-3 p-4 rounded-lg ${
            uploadResult.success 
              ? 'bg-green-900/20 border border-green-700' 
              : 'bg-red-900/20 border border-red-700'
          }`}>
            {uploadResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className={`text-sm font-medium ${
                uploadResult.success ? 'text-green-300' : 'text-red-300'
              }`}>
                {uploadResult.success ? 'Success!' : 'Error'}
              </p>
              <p className="text-gray-300 text-sm mt-1">
                {uploadResult.message}
              </p>
              {uploadResult.success && uploadResult.chunks && (
                <p className="text-gray-400 text-xs mt-2">
                  Created {uploadResult.chunks} text chunks from {uploadResult.totalTextLength} characters
                </p>
              )}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-400 space-y-1">
          <p>• Supported format: PDF files only</p>
          <p>• Maximum file size: 10MB</p>
          <p>• Documents are processed into searchable chunks for AI suggestions</p>
        </div>
      </CardContent>
    </Card>
  );
};
