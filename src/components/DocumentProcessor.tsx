
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDocumentKnowledge } from '@/hooks/useDocumentKnowledge';
import { useToast } from '@/hooks/use-toast';
import { FileText, Brain, Loader2 } from 'lucide-react';

export const DocumentProcessor = () => {
  const [hasProcessed, setHasProcessed] = useState(false);
  const { processDocuments, isProcessing, error, clearError } = useDocumentKnowledge();
  const { toast } = useToast();

  const handleProcessDocuments = async () => {
    clearError();
    const success = await processDocuments();
    
    if (success) {
      setHasProcessed(true);
      toast({
        title: "Documents processed successfully!",
        description: "Your PDF documents have been analyzed and are now available for AI assistance.",
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
        <div className="grid grid-cols-2 gap-2">
          {['DTM.pdf', 'FAQ.pdf', 'MPA.pdf', 'OLB.pdf'].map((doc) => (
            <div key={doc} className="flex items-center gap-2 p-2 bg-gray-700 rounded">
              <FileText className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-300">{doc}</span>
            </div>
          ))}
        </div>
        
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleProcessDocuments}
            disabled={isProcessing}
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
                {hasProcessed ? 'Reprocess Documents' : 'Process Documents for AI'}
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
          <p>• This will extract text from your PDF documents</p>
          <p>• Content will be stored for AI-powered suggestions</p>
          <p>• Your documents will be referenced when generating replies</p>
        </div>
      </CardContent>
    </Card>
  );
};
