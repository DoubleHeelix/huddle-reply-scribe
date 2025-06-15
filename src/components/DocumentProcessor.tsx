
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDocumentKnowledge } from '@/hooks/useDocumentKnowledge';
import { useToast } from '@/hooks/use-toast';
import { FileText, Brain, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const DocumentProcessor = () => {
  const [hasProcessed, setHasProcessed] = useState(false);
  const [storageFiles, setStorageFiles] = useState<string[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const { processDocuments, isProcessing, error, clearError } = useDocumentKnowledge();
  const { toast } = useToast();

  // Load files from storage on component mount
  useEffect(() => {
    loadStorageFiles();
  }, []);

  const loadStorageFiles = async () => {
    try {
      setIsLoadingFiles(true);
      
      const { data: files, error } = await supabase.storage
        .from('documents')
        .list('', {
          limit: 100,
          offset: 0
        });

      if (error) {
        console.error('Error loading storage files:', error);
        return;
      }

      const pdfFiles = (files || [])
        .filter(file => file.name.toLowerCase().endsWith('.pdf'))
        .map(file => file.name);

      setStorageFiles(pdfFiles);
    } catch (err) {
      console.error('Error in loadStorageFiles:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleProcessDocuments = async () => {
    clearError();
    const success = await processDocuments();
    
    if (success) {
      setHasProcessed(true);
      toast({
        title: "Documents processed successfully!",
        description: "Your PDF documents from storage have been analyzed and are now available for AI assistance.",
      });
    } else {
      toast({
        title: "Processing failed",
        description: error || "Failed to process documents. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Brain className="w-5 h-5 text-purple-400" />
          Document Knowledge Processing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoadingFiles ? (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading documents from storage...
          </div>
        ) : storageFiles.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {storageFiles.map((fileName) => (
              <div key={fileName} className="flex items-center gap-2 p-2 bg-gray-700 rounded">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-300">{fileName}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 p-4 bg-gray-700 rounded">
            <Upload className="w-8 h-8 text-gray-400" />
            <div className="text-center">
              <p className="text-gray-300 text-sm">No PDF documents found in storage</p>
              <p className="text-gray-400 text-xs">Upload PDFs to the 'documents' bucket in Supabase Storage</p>
            </div>
            <Button
              onClick={loadStorageFiles}
              variant="outline"
              size="sm"
              className="text-gray-300 border-gray-600"
            >
              Refresh Files
            </Button>
          </div>
        )}
        
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleProcessDocuments}
            disabled={isProcessing || storageFiles.length === 0}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing Documents...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 mr-2" />
                {hasProcessed ? 'Reprocess Storage Documents' : 'Process Storage Documents for AI'}
              </>
            )}
          </Button>
          
          {hasProcessed && (
            <Badge variant="secondary" className="self-center bg-green-600 text-white">
              Documents ready for AI assistance
            </Badge>
          )}
          
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </div>
        
        <div className="text-xs text-gray-400 space-y-1">
          <p>• This will extract text from PDFs in your Supabase Storage</p>
          <p>• Content will be stored for AI-powered suggestions</p>
          <p>• Your documents will be referenced when generating replies</p>
          <p>• Upload PDFs to the 'documents' bucket in Storage</p>
        </div>
      </CardContent>
    </Card>
  );
};
