
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  fileName: string;
  fileContent: string; // Base64 encoded PDF content
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('No authorization token provided');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Invalid authorization token');
    }

    const { fileName, fileContent }: RequestBody = await req.json();

    console.log('Processing PDF:', fileName);

    // Convert base64 to binary
    const pdfBuffer = Uint8Array.from(atob(fileContent), c => c.charCodeAt(0));

    // Extract text from PDF using a simple text extraction approach
    // For production, you might want to use a more robust PDF parsing service
    let extractedText = '';
    
    try {
      // Convert PDF binary to text (simplified approach)
      // In production, you'd use a proper PDF parsing library or service
      const textDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
      const pdfText = textDecoder.decode(pdfBuffer);
      
      // Extract readable text from PDF content
      // This is a basic approach - for better results, consider using pdf-parse or similar
      const textMatches = pdfText.match(/[a-zA-Z0-9\s.,!?;:'"-()[\]{}]+/g);
      if (textMatches) {
        extractedText = textMatches.join(' ').replace(/\s+/g, ' ').trim();
      }
      
      // If basic extraction doesn't work well, try alternative approach
      if (extractedText.length < 100) {
        // Extract text between common PDF text markers
        const betweenStreams = pdfText.split('stream')[1];
        if (betweenStreams) {
          const cleanText = betweenStreams
            .replace(/[^\x20-\x7E]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          extractedText = cleanText.length > extractedText.length ? cleanText : extractedText;
        }
      }
      
    } catch (error) {
      console.error('PDF text extraction error:', error);
      throw new Error('Failed to extract text from PDF');
    }

    if (!extractedText || extractedText.length < 50) {
      throw new Error('Could not extract meaningful text from PDF. Please ensure the PDF contains readable text.');
    }

    console.log('Extracted text length:', extractedText.length);

    // Split text into chunks for better processing
    const chunkSize = 1000; // Adjust based on your needs
    const chunks = [];
    for (let i = 0; i < extractedText.length; i += chunkSize) {
      chunks.push(extractedText.slice(i, i + chunkSize));
    }

    console.log('Created', chunks.length, 'text chunks');

    // Process each chunk and create embeddings
    const processedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Create embedding for this chunk
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: chunk,
          model: 'text-embedding-3-small'
        }),
      });

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;

      // Store in database
      const { data, error } = await supabase
        .from('document_knowledge')
        .insert({
          user_id: user.id,
          document_name: fileName,
          document_type: 'pdf',
          content_chunk: chunk,
          chunk_index: i,
          embedding: embedding,
          metadata: {
            total_chunks: chunks.length,
            chunk_length: chunk.length,
            file_size: pdfBuffer.length
          }
        });

      if (error) {
        console.error('Database insert error:', error);
        throw new Error(`Failed to store document chunk: ${error.message}`);
      }

      processedChunks.push({
        chunk_index: i,
        content_length: chunk.length
      });

      console.log(`Processed chunk ${i + 1}/${chunks.length}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully processed "${fileName}" into ${chunks.length} chunks`,
        chunks: processedChunks.length,
        totalTextLength: extractedText.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in process-pdf function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
