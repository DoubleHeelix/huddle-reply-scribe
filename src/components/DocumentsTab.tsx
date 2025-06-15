
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Trash2, RefreshCcw, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface DocumentInfo {
  document_name: string;
  document_type: string;
  chunks: number;
  total_text_length: number;
  processed_at: string;
}

export const DocumentsTab = () => {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('document_knowledge')
        .select(`
          document_name,
          document_type,
          processed_at,
          metadata
        `)
        .order('processed_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      // Group by document and aggregate data
      const documentMap = new Map<string, DocumentInfo>();
      
      data?.forEach((item) => {
        const key = item.document_name;
        if (!documentMap.has(key)) {
          documentMap.set(key, {
            document_name: item.document_name,
            document_type: item.document_type || 'pdf',
            chunks: 0,
            total_text_length: 0,
            processed_at: item.processed_at
          });
        }
        
        const doc = documentMap.get(key)!;
        doc.chunks++;
        if (item.metadata && typeof item.metadata === 'object' && 'chunk_length' in item.metadata) {
          doc.total_text_length += (item.metadata as any).chunk_length || 0;
        }
      });

      setDocuments(Array.from(documentMap.values()));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch documents';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDocument = async (documentName: string) => {
    try {
      const { error } = await supabase
        .from('document_knowledge')
        .delete()
        .eq('document_name', documentName);

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: 'Document Deleted',
        description: `"${documentName}" has been removed from your knowledge base.`,
      });

      fetchDocuments(); // Refresh list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete document';
      toast({
        title: 'Delete Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-2 text-purple-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
          <span className="font-sans">Loading documents...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-6 text-center">
          <p className="text-red-400 mb-4 font-sans">Error loading documents: {error}</p>
          <Button onClick={fetchDocuments} variant="outline" className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 font-sans">
            <RefreshCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-6 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-white text-lg font-medium mb-2 font-sans">No Documents Yet</h3>
          <p className="text-gray-400 font-sans">
            Upload PDF documents to build your AI knowledge base and get more informed suggestions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-white text-lg font-medium font-sans">
          Knowledge Base ({documents.length} documents)
        </h3>
        <Button 
          onClick={fetchDocuments} 
          variant="outline" 
          size="sm"
          className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 font-sans"
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {documents.map((doc) => (
          <Card key={doc.document_name} className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span className="text-white font-medium font-sans truncate">
                    {doc.document_name}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="font-sans">
                    {doc.document_type.toUpperCase()}
                  </Badge>
                  <Button
                    onClick={() => deleteDocument(doc.document_name)}
                    variant="outline"
                    size="sm"
                    className="bg-red-900/20 border-red-700 text-red-400 hover:bg-red-900/40 h-6 w-6 p-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-sans">Chunks:</span>
                  <span className="text-gray-300 font-sans">{doc.chunks}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-sans">Text Length:</span>
                  <span className="text-gray-300 font-sans">{doc.total_text_length.toLocaleString()} chars</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-sans">Processed:</span>
                  <div className="flex items-center gap-1 text-gray-300">
                    <Calendar className="w-3 h-3" />
                    <span className="font-sans">
                      {formatDistanceToNow(new Date(doc.processed_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-xs text-gray-400 font-sans">
        <p>Documents are automatically processed into searchable chunks for AI suggestions.</p>
      </div>
    </div>
  );
};
