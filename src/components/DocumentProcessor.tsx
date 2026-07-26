
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

      const supportedFiles = data?.filter(file =>
        (file.name.toLowerCase().endsWith('.pdf') ||
          file.name.toLowerCase().endsWith('.docx')) &&
        file.name !== '.emptyFolderPlaceholder'
      ) || [];
      
      setStorageFiles(supportedFiles);
    } catch (err) {
      console.error('Error fetching storage files:', err);
      setStorageError('Failed to load files from storage. Is the bucket public?');
    } finally {
      setIsLoadingStorage(false);
    }
  };

  useEffect(() => {
    fetchStorageFiles();
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
    <Card className="border-[#826f56]/15 bg-white/70 dark:border-white/10 dark:bg-[#151513]">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[#29231c] text-lg font-medium mb-2 font-sans dark:text-[#f4efe7]">Document Knowledge Base</h3>
            <p className="text-[#776b5d] text-sm font-sans dark:text-[#b4a89a]">
              Process PDF and DOCX documents from Supabase storage to enhance AI responses.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={fetchStorageFiles}
              variant="outline"
              size="sm"
              aria-label="Refresh documents"
              disabled={isLoadingStorage}
              className="border-[#826f56]/15 bg-white/80 text-[#29231c] hover:bg-[#efe7dc] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#f4efe7] dark:hover:bg-white/[0.08]"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingStorage ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              onClick={handleProcessAll}
              variant="outline"
              size="sm"
              disabled={isProcessing || storageFiles.every(file => isDocumentProcessed(file.name))}
              className="border-[#c49b5d] bg-[#c49b5d] text-[#071326] hover:bg-[#b58a52]"
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
          <div className="bg-[#eaf1fa] border border-[#b9cbe5] rounded-lg p-3 dark:border-[#355981] dark:bg-[#102033]">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#2f5d8c] dark:border-[#7ea4d6]"></div>
              <span className="text-[#2f5d8c] text-sm font-sans dark:text-[#7ea4d6]">Processing document...</span>
            </div>
          </div>
        )}

        {/* Storage Files List */}
        {storageFiles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[#29231c] text-sm font-medium font-sans dark:text-[#f4efe7]">Available Documents in Storage</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {storageFiles.map((file) => {
                const isProcessed = isDocumentProcessed(file.name);
                return (
                  <div key={file.name} className="bg-[#fffcf7] p-3 rounded-lg border border-[#826f56]/15 dark:border-white/10 dark:bg-[#0d0c0b]/70">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="w-4 h-4 text-[#2f5d8c] flex-shrink-0 dark:text-[#7ea4d6]" />
                        <span className="text-[#29231c] text-sm font-sans truncate dark:text-[#f4efe7]">
                          {file.name}
                        </span>
                        {isProcessed && (
                          <Badge variant="secondary" className="text-xs border border-[#348f6a]/30 bg-[#bcefd8]/70 text-[#23684c] dark:bg-[#348f6a]/10 dark:text-[#6ee7b7]">
                            Processed
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          onClick={() => downloadFile(file.name)}
                          variant="ghost"
                          size="sm"
                          aria-label={`Download ${file.name}`}
                          className="text-[#776b5d] hover:text-[#29231c] hover:bg-[#efe7dc] dark:text-[#b4a89a] dark:hover:text-[#f4efe7] dark:hover:bg-white/[0.08]"
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
                            className="text-[#2f5d8c] hover:text-[#1b2f4a] hover:bg-[#eaf1fa] dark:text-[#7ea4d6] dark:hover:text-[#eaf1fa] dark:hover:bg-[#102033]"
                          >
                            Process
                          </Button>
                        )}
                      </div>
                    </div>
                    {isProcessed && (
                      <div className="flex items-center gap-1 mt-1">
                        <CheckCircle className="w-3 h-3 text-[#23684c] dark:text-[#6ee7b7]" />
                        <span className="text-[#23684c] text-xs font-sans dark:text-[#6ee7b7]">Ready for AI</span>
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
          <div className="mt-4 pt-4 border-t border-[#826f56]/15 dark:border-white/10">
            <h4 className="text-[#29231c] text-sm font-medium font-sans mb-2 dark:text-[#f4efe7]">Knowledge Base Summary</h4>
            <div className="text-[#776b5d] text-sm font-sans dark:text-[#b4a89a]">
              {documents.length} document(s) processed with {documents.reduce((sum, doc) => sum + doc.chunks, 0)} total chunks
            </div>
          </div>
        )}

        {storageFiles.length === 0 && !isLoadingStorage && (
          <div className="text-center py-4">
            <FileText className="w-8 h-8 text-[#776b5d] mx-auto mb-2 dark:text-[#b4a89a]" />
            <p className="text-[#776b5d] text-sm font-sans dark:text-[#b4a89a]">
              No PDF or DOCX files found in Supabase storage
            </p>
            <p className="text-[#776b5d] text-xs font-sans mt-1 dark:text-[#b4a89a]">
              Upload PDF or DOCX files to the 'documents' bucket in Supabase storage
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
