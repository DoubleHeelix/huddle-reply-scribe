
import { supabase } from '@/integrations/supabase/client';
import { DocumentSummary } from '@/types/document';

export const documentService = {
  async fetchDocuments(): Promise<DocumentSummary[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('document_knowledge')
      .select('document_name, processed_at')
      .eq('user_id', user.id);

    if (error) throw error;

    // Group by document and count chunks
    const documentMap = new Map<string, { processed_at: string; chunks: number }>();
    
    data.forEach(item => {
      if (documentMap.has(item.document_name)) {
        documentMap.get(item.document_name)!.chunks++;
      } else {
        documentMap.set(item.document_name, {
          processed_at: item.processed_at,
          chunks: 1
        });
      }
    });

    return Array.from(documentMap.entries()).map(
      ([name, info]) => ({
        document_name: name,
        chunks: info.chunks,
        processed_at: info.processed_at
      })
    );
  },

  async processDocumentFromStorage(fileName: string): Promise<any> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Download the file from storage first
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(fileName);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Convert to base64 without causing stack overflow for large files
    const arrayBuffer = await fileData.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    // Call the edge function with the correct parameters
    const { data, error } = await supabase.functions.invoke('create-embedding', {
      body: {
        document_name: fileName,
        document_content: base64,
        user_id: user.id
      }
    });

    if (error) {
      throw new Error(`Processing failed: ${error.message}`);
    }

    return data;
  },

  async deleteDocument(documentName: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('document_knowledge')
      .delete()
      .eq('user_id', user.id)
      .eq('document_name', documentName);

    if (error) throw error;
  }
};
