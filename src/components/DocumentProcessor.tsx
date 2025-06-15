
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { useDocumentKnowledge } from '@/hooks/useDocumentKnowledge';

export const DocumentProcessor: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const {
    documents,
    uploadDocument,
    deleteDocument,
    isProcessing,
    error,
    clearError
  } = useDocumentKnowledge();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file only.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('File size must be less than 10MB.');
      return;
    }

    setIsUploading(true);
    try {
      await uploadDocument(file);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
      // Reset the input
      event.target.value = '';
    }
  };

  const handleDeleteDocument = async (documentName: string) => {
    if (window.confirm(`Are you sure you want to delete "${documentName}"? This action cannot be undone.`)) {
      await deleteDocument(documentName);
    }
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="p-4 space-y-4">
        <div>
          <h3 className="text-white text-lg font-medium mb-2 font-sans">Document Knowledge Base</h3>
          <p className="text-gray-400 text-sm font-sans">
            Upload PDF documents to enhance AI responses with your knowledge base.
          </p>
        </div>

        {/* Upload Section */}
        <div className="border-2 border-dashed border-blue-500 rounded-lg p-4 bg-blue-500/5">
          <Input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
            id="document-upload"
            disabled={isUploading || isProcessing}
          />
          <label 
            htmlFor="document-upload" 
            className="cursor-pointer flex flex-col items-center space-y-2"
          >
            <Upload className="w-6 h-6 text-blue-400" />
            <div className="bg-gray-700 px-4 py-2 rounded-lg border border-gray-600">
              <span className="text-white text-sm font-sans">
                {isUploading ? "Uploading..." : "Upload PDF Document"}
              </span>
            </div>
            <p className="text-gray-500 text-xs font-sans">PDF files only • Max 10MB</p>
          </label>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border border-red-600 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-400 text-sm font-sans">{error}</span>
            </div>
            <Button
              onClick={clearError}
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

        {/* Documents List */}
        {documents.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-white text-sm font-medium font-sans">Uploaded Documents</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {documents.map((doc) => (
                <div key={doc.document_name} className="bg-gray-900 p-3 rounded-lg border border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span className="text-white text-sm font-sans truncate">
                        {doc.document_name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {doc.chunks} chunks
                      </Badge>
                    </div>
                    <Button
                      onClick={() => handleDeleteDocument(doc.document_name)}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <CheckCircle className="w-3 h-3 text-green-400" />
                    <span className="text-green-400 text-xs font-sans">Ready for AI</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {documents.length === 0 && !isProcessing && (
          <div className="text-center py-4">
            <FileText className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <p className="text-gray-500 text-sm font-sans">No documents uploaded yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
