
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestBody = await req.json();
    console.log('Request body:', requestBody);

    // Handle search query (for document search)
    if (requestBody.query_text) {
      const { query_text } = requestBody;
      
      console.log('Creating embedding for search query:', query_text.substring(0, 100));

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: query_text,
          model: 'text-embedding-3-small'
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      const embedding = data.data[0].embedding;

      return new Response(
        JSON.stringify({ embedding }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Handle document processing
    if (requestBody.document_name && requestBody.document_content && requestBody.user_id) {
      const { document_name, document_content, user_id } = requestBody;
      
      console.log('Processing document:', document_name, 'for user:', user_id);

      // Decode base64 content
      const decodedContent = atob(document_content);
      
      // For now, create simple chunks (in production, you'd want proper PDF parsing)
      const chunkSize = 1000;
      const chunks = [];
      
      for (let i = 0; i < decodedContent.length; i += chunkSize) {
        chunks.push(decodedContent.slice(i, i + chunkSize));
      }

      console.log(`Created ${chunks.length} chunks from document`);

      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        // Sanitize chunk to remove null characters that cause database errors
        const sanitizedChunk = chunk.replace(/\u0000/g, "");
        
        // Create embedding for chunk
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: sanitizedChunk,
            model: 'text-embedding-3-small'
          }),
        });

        if (!embeddingResponse.ok) {
          const errorData = await embeddingResponse.text();
          throw new Error(`OpenAI API error: ${embeddingResponse.status} - ${errorData}`);
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        // Store in database with proper structure
        const { error: insertError } = await supabase
          .from('document_knowledge')
          .insert({
            user_id,
            document_name,
            content_chunk: sanitizedChunk,
            embedding,
            chunk_index: i,
            metadata: {
              total_chunks: chunks.length,
              chunk_size: chunk.length
            }
          });

        if (insertError) {
          console.error('Database insert error:', insertError);
          throw new Error(`Failed to store chunk ${i}: ${insertError.message}`);
        }
      }

      console.log(`Successfully processed ${chunks.length} chunks for ${document_name}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          chunks_processed: chunks.length,
          document_name 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    throw new Error('Invalid request format. Expected query_text or document processing parameters.');

  } catch (error) {
    console.error('Error in create-embedding function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
