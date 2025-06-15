import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDocumentKnowledge } from '@/hooks/useDocumentKnowledge';
import { useToast } from '@/hooks/use-toast';
import { FileText, Brain, Loader2, Upload, RefreshCw, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const DocumentProcessor = () => {
  const [hasProcessed, setHasProcessed] = useState(false);
  const [storageFiles, setStorageFiles] = useState<string[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [processedDocuments, setProcessedDocuments] = useState<string[]>([]);
  const [isCleaningErrors, setIsCleaningErrors] = useState(false);
  const { processDocuments, isProcessing, error, clearError } = useDocumentKnowledge();
  const { toast } = useToast();

  // Load files from storage on component mount
  useEffect(() => {
    loadStorageFiles();
    loadProcessedDocuments();
  }, []);

  const loadStorageFiles = async () => {
    try {
      setIsLoadingFiles(true);
      console.log('📁 DEBUG: Loading files from documents bucket...');
      
      const { data: files, error } = await supabase.storage
        .from('documents')
        .list('', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error) {
        console.error('❌ DEBUG: Error loading storage files:', error);
        toast({
          title: "Error loading files",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      const pdfFiles = (files || [])
        .filter(file => {
          const isPdf = file.name.toLowerCase().endsWith('.pdf');
          const isNotFolder = file.name !== '.emptyFolderPlaceholder';
          return isPdf && isNotFolder;
        })
        .map(file => file.name);

      console.log('📄 DEBUG: Filtered PDF files:', pdfFiles);
      setStorageFiles(pdfFiles);
    } catch (err) {
      console.error('❌ DEBUG: Error in loadStorageFiles:', err);
      toast({
        title: "Error",
        description: "Failed to load files from storage",
        variant: "destructive",
      });
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const loadProcessedDocuments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Only count documents that have valid content (not error messages)
      const { data, error } = await supabase
        .from('document_knowledge')
        .select('document_name')
        .eq('user_id', user.id)
        .not('content_chunk', 'like', '%Unable to extract text%')
        .not('content_chunk', 'like', '%PDF processing failed%');

      if (error) {
        console.error('❌ DEBUG: Error loading processed documents:', error);
        return;
      }

      const uniqueDocuments = [...new Set(data.map(doc => doc.document_name))];
      setProcessedDocuments(uniqueDocuments);
      console.log('📋 DEBUG: Successfully processed documents:', uniqueDocuments);
    } catch (err) {
      console.error('❌ DEBUG: Error in loadProcessedDocuments:', err);
    }
  };

  const cleanErrorEntries = async () => {
    try {
      setIsCleaningErrors(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('🧹 DEBUG: Cleaning error entries from database...');

      const { error } = await supabase
        .from('document_knowledge')
        .delete()
        .eq('user_id', user.id)
        .or('content_chunk.like.%Unable to extract text%,content_chunk.like.%PDF processing failed%');

      if (error) {
        console.error('❌ DEBUG: Error cleaning database:', error);
        toast({
          title: "Error",
          description: "Failed to clean error entries",
          variant: "destructive",
        });
        return;
      }

      console.log('✅ DEBUG: Error entries cleaned successfully');
      await loadProcessedDocuments();
      
      toast({
        title: "Database cleaned",
        description: "Removed error entries from the database",
      });
    } catch (err) {
      console.error('❌ DEBUG: Error cleaning entries:', err);
      toast({
        title: "Error",
        description: "Failed to clean database",
        variant: "destructive",
      });
    } finally {
      setIsCleaningErrors(false);
    }
  };

  const handleProcessDocuments = async () => {
    if (storageFiles.length === 0) {
      toast({
        title: "No documents found",
        description: "Please upload PDF files to the 'documents' bucket in Supabase Storage first.",
        variant: "destructive",
      });
      return;
    }

    clearError();
    console.log('🔄 DEBUG: Starting document processing...');
    
    const success = await processDocuments();
    
    if (success) {
      setHasProcessed(true);
      await loadProcessedDocuments();
      toast({
        title: "Documents processed successfully!",
        description: `${storageFiles.length} PDF document(s) have been analyzed and are now available for AI assistance.`,
      });
    } else {
      toast({
        title: "Processing failed",
        description: error || "Failed to process documents. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getUnprocessedFiles = () => {
    return storageFiles.filter(fileName => {
      const docName = fileName.replace('.pdf', '');
      return !processedDocuments.includes(docName);
    });
  };

  const unprocessedFiles = getUnprocessedFiles();

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-white text-lg font-sans">
          <Brain className="w-5 h-5 text-purple-400" />
          Document Knowledge Processing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Files Status Section */}
        <div className="space-y-4">
          {isLoadingFiles ? (
            <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="font-sans">Loading documents from storage...</span>
            </div>
          ) : storageFiles.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-white text-sm font-medium font-sans">
                  📄 Found {storageFiles.length} PDF{storageFiles.length !== 1 ? 's' : ''} in Storage
                </h4>
                <div className="flex gap-2">
                  <Button
                    onClick={cleanErrorEntries}
                    variant="ghost"
                    size="sm"
                    disabled={isCleaningErrors}
                    className="text-red-400 hover:text-red-300 h-6 px-2 font-sans"
                  >
                    {isCleaningErrors ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3 mr-1" />
                    )}
                    Clean Errors
                  </Button>
                  <Button
                    onClick={() => {
                      loadStorageFiles();
                      loadProcessedDocuments();
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white h-6 px-2 font-sans"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Refresh
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                {storageFiles.map((fileName) => {
                  const docName = fileName.replace('.pdf', '');
                  const isProcessed = processedDocuments.includes(docName);
                  
                  return (
                    <div key={fileName} className="flex items-center gap-2 p-2 bg-gray-700/50 rounded border border-gray-600">
                      <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span className="text-sm text-gray-300 font-sans truncate flex-1">{fileName}</span>
                      {isProcessed ? (
                        <Badge variant="secondary" className="bg-green-600 text-white text-xs px-2 py-0.5">
                          ✓ Processed
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-yellow-600 text-white text-xs px-2 py-0.5">
                          Pending
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {unprocessedFiles.length > 0 && (
                <div className="flex items-center gap-2 text-yellow-400 text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{unprocessedFiles.length} document{unprocessedFiles.length !== 1 ? 's' : ''} need{unprocessedFiles.length === 1 ? 's' : ''} processing</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto bg-gray-700 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-gray-400" />
              </div>
              <div className="space-y-2">
                <h4 className="text-white text-sm font-medium font-sans">No PDF documents found</h4>
                <p className="text-gray-400 text-xs font-sans">Upload PDFs to the 'documents' bucket in Supabase Storage</p>
              </div>
              <Button
                onClick={loadStorageFiles}
                variant="outline"
                size="sm"
                className="text-gray-300 border-gray-600 hover:bg-gray-700 font-sans"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Check Again
              </Button>
            </div>
          )}
        </div>
        
        {/* Processing Section */}
        <div className="space-y-4">
          <Button
            onClick={handleProcessDocuments}
            disabled={isProcessing || storageFiles.length === 0}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 font-sans h-12"
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing Documents...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                {unprocessedFiles.length > 0 
                  ? `Process ${unprocessedFiles.length} New Document${unprocessedFiles.length !== 1 ? 's' : ''}` 
                  : hasProcessed 
                    ? 'Reprocess All Documents' 
                    : 'Process All Documents for AI'
                }
              </div>
            )}
          </Button>
          
          {processedDocuments.length > 0 && (
            <div className="flex justify-center">
              <Badge variant="secondary" className="bg-green-600 text-white font-sans">
                ✅ {processedDocuments.length} document{processedDocuments.length !== 1 ? 's' : ''} ready for AI assistance
              </Badge>
            </div>
          )}
          
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-600 rounded-lg">
              <p className="text-sm text-red-400 font-sans">{error}</p>
            </div>
          )}
        </div>
        
        {/* Info Section */}
        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
          <h5 className="text-white text-sm font-medium mb-2 font-sans">How it works:</h5>
          <div className="text-xs text-gray-400 space-y-1 font-sans">
            <p>• Extracts text from PDFs in your Supabase Storage</p>
            <p>• Creates AI embeddings for intelligent content search</p>
            <p>• References your documents when generating replies</p>
            <p>• Upload PDFs to the 'documents' bucket in Storage first</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
