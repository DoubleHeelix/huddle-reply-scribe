
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, RefreshCw, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { useDocumentKnowledge } from '@/hooks/useDocumentKnowledge';
import { supabase } from '@/integrations/supabase/client';
import type { FileObject } from '@supabase/storage-js';

export const DocumentProcessor: React.FC = () => {
  const [storageFiles, setStorageFiles] = useState<FileObject[]>([]);
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  
  const {
    documents,
    processStorageDocument,
    deleteDocument,
    isProcessing,
    error,
    clearError,
    refreshDocuments
  } = useDocumentKnowledge();

  const fetchStorageFiles = async () => {
    try {
      setIsLoadingStorage(true);
      setStorageError(null);
      
      const { data, error } = await supabase.storage.from('documents').list();

      if (error) throw error;

      const pdfFiles = data?.filter(file =>
        file.name.toLowerCase().endsWith('.pdf') &&
        file.name !== '.emptyFolderPlaceholder'
      ) || [];
      
      setStorageFiles(pdfFiles);
    } catch (err) {
      console.error('Error fetching storage files:', err);
      setStorageError('Failed to load files from storage. Is the bucket public?');
    } finally {
      setIsLoadingStorage(false);
    }
  };

  useEffect(() => {
    fetchStorageFiles();
    const checkData = async () => {
      const { data, error } = await supabase.from('document_knowledge').select('*').limit(5);
      console.log('DATABASE CHECK: document_knowledge table sample:', data);
      if (error) {
        console.error('DATABASE CHECK ERROR:', error);
      }
    };
    checkData();
  }, []);

  const handleProcessDocument = async (fileName: string) => {
    try {
      await processStorageDocument(fileName);
      await refreshDocuments();
    } catch (err) {
      console.error('Error processing document:', err);
    }
  };

  const handleDeleteDocument = async (documentName: string) => {
    if (window.confirm(`Are you sure you want to delete "${documentName}" from your knowledge base?`)) {
      await deleteDocument(documentName);
    }
  };

  const isDocumentProcessed = (fileName: string) => {
    return documents.some(doc => doc.document_name === fileName);
  };

  const downloadFile = async (fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(fileName);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
    }
  };

  const handleProcessAll = async () => {
    const unprocessedFiles = storageFiles.filter(file => !isDocumentProcessed(file.name));
    if (unprocessedFiles.length === 0) {
      return;
    }

    for (const file of unprocessedFiles) {
      await handleProcessDocument(file.name);
    }
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white text-lg font-medium mb-2 font-sans">Document Knowledge Base</h3>
            <p className="text-gray-400 text-sm font-sans">
              Process PDF documents from Supabase storage to enhance AI responses.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={fetchStorageFiles}
              variant="outline"
              size="sm"
              disabled={isLoadingStorage}
              className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingStorage ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              onClick={handleProcessAll}
              variant="outline"
              size="sm"
              disabled={isProcessing || storageFiles.every(file => isDocumentProcessed(file.name))}
              className="bg-blue-600 border-blue-500 text-white hover:bg-blue-500"
            >
              Process All
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {(error || storageError) && (
          <div className="bg-red-900/20 border border-red-600 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-400 text-sm font-sans">{error || storageError}</span>
            </div>
            <Button
              onClick={() => {
                clearError();
                setStorageError(null);
              }}
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300"
            >
              ×
            </Button>
          </div>
        )}

        {/* Processing Status */}
        {isProcessing && (
          <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              <span className="text-blue-400 text-sm font-sans">Processing document...</span>
            </div>
          </div>
        )}

        {/* Storage Files List */}
        {storageFiles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-white text-sm font-medium font-sans">Available Documents in Storage</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {storageFiles.map((file) => {
                const isProcessed = isDocumentProcessed(file.name);
                return (
                  <div key={file.name} className="bg-gray-900 p-3 rounded-lg border border-gray-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <span className="text-white text-sm font-sans truncate">
                          {file.name}
                        </span>
                        {isProcessed && (
                          <Badge variant="secondary" className="text-xs bg-green-900 text-green-300">
                            Processed
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          onClick={() => downloadFile(file.name)}
                          variant="ghost"
                          size="sm"
                          className="text-gray-400 hover:text-gray-300 hover:bg-gray-700"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        {isProcessed ? (
                          <Button
                            onClick={() => handleDeleteDocument(file.name)}
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          >
                            Remove
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleProcessDocument(file.name)}
                            variant="ghost"
                            size="sm"
                            disabled={isProcessing}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                          >
                            Process
                          </Button>
                        )}
                      </div>
                    </div>
                    {isProcessed && (
                      <div className="flex items-center gap-1 mt-1">
                        <CheckCircle className="w-3 h-3 text-green-400" />
                        <span className="text-green-400 text-xs font-sans">Ready for AI</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Processed Documents Summary */}
        {documents.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-600">
            <h4 className="text-white text-sm font-medium font-sans mb-2">Knowledge Base Summary</h4>
            <div className="text-gray-400 text-sm font-sans">
              {documents.length} document(s) processed with {documents.reduce((sum, doc) => sum + doc.chunks, 0)} total chunks
            </div>
          </div>
        )}

        {storageFiles.length === 0 && !isLoadingStorage && (
          <div className="text-center py-4">
            <FileText className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <p className="text-gray-500 text-sm font-sans">
              No PDF files found in Supabase storage
            </p>
            <p className="text-gray-600 text-xs font-sans mt-1">
              Upload PDFs to the 'documents' bucket in Supabase storage
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
