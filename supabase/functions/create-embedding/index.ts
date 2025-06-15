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
      console.error('OpenAI API key not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase configuration missing');
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- Validate and log the request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (err) {
      console.error("Failed to parse JSON body", err);
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    console.log('Request body keys:', Object.keys(requestBody));

    // SEARCH FLOW (no changes)
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
        console.error('OpenAI API error:', response.status, errorData);
        return new Response(
          JSON.stringify({ error: `OpenAI API error: ${response.status} - ${errorData}` }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
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

    // --- DOCUMENT INGESTION FLOW
    if (requestBody.document_name && requestBody.document_content && requestBody.user_id) {
      const { document_name, document_content, user_id } = requestBody;
      console.log('Processing document:', document_name, 'for user:', user_id);

      try {
        // Make sure input is a PDF filename
        if (
          !document_name.toLowerCase().endsWith('.pdf') ||
          typeof document_content !== 'string' ||
          typeof user_id !== 'string'
        ) {
          console.error('Invalid input for PDF processing.');
          return new Response(
            JSON.stringify({ error: 'Invalid input: Only PDF files supported.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // --- Decode PDF content
        let decodedContent = "";
        try {
          decodedContent = atob(document_content);
        } catch (err) {
          console.error('Error decoding base64 content:', err);
          return new Response(
            JSON.stringify({ error: 'Failed to decode PDF content.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        console.log('Decoded content length:', decodedContent.length);

        // --- Extract mostly-readable PDF text
        let textContent = "";
        try {
          // Simple text extraction: favor lines with readable ASCII
          const lines = decodedContent.split('\n');
          for (const line of lines) {
            const readableText = line.replace(/[^\x20-\x7E\s]/g, '').trim();
            if (readableText.length > 10 && readableText.length > (line.length * 0.3)) {
              textContent += readableText + ' ';
            }
          }
        } catch (err) {
          console.error('PDF text extraction error:', err);
          return new Response(
            JSON.stringify({ error: "PDF text extraction failed." }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        if (textContent.length < 50) {
          console.error('Extracted text is too short:', textContent.length);
          return new Response(
            JSON.stringify({ error: "Could not extract text from PDF. Ensure the PDF contains readable text." }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        console.log('Extracted text length:', textContent.length);

        // --- Chunk text for embedding
        const chunkSize = 1000;
        const chunks = [];
        for (let i = 0; i < textContent.length; i += chunkSize) {
          const chunk = textContent.slice(i, i + chunkSize).trim();
          if (chunk.length > 10) {
            chunks.push(chunk);
          }
        }
        console.log(`Created ${chunks.length} chunks from document`);

        if (!chunks.length) {
          return new Response(
            JSON.stringify({ error: 'No meaningful text content found in the document' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // --- Embedding and insert (with detailed logs)
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          console.log(`Processing chunk ${i + 1}/${chunks.length}, length: ${chunk.length}`);

          // --- Create embedding
          let embedding = null;
          try {
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

            if (!embeddingResponse.ok) {
              const errorData = await embeddingResponse.text();
              console.error('OpenAI API error for chunk', i, ':', errorData);
              throw new Error('OpenAI API error: ' + errorData);
            }
            const embeddingData = await embeddingResponse.json();
            embedding = embeddingData.data[0].embedding;
          } catch (err) {
            console.error(`Error getting embedding for chunk ${i} (${chunk.slice(0, 30)}...):`, err);
            return new Response(
              JSON.stringify({ error: `Embedding failed for chunk ${i}: ${err.message}` }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
          }

          // --- Prepare DB row, log, insert
          const insertData = {
            user_id,
            document_name,
            content_chunk: chunk,
            embedding,
            chunk_index: i,
            metadata: {
              total_chunks: chunks.length,
              chunk_size: chunk.length,
              original_document_size: decodedContent.length,
            }
          };

          console.log('Insert payload for chunk', i, ':', {
            user_id, document_name, chunk_index: i, chunk_len: chunk.length,
          });

          const { error: insertError, data: insertResult } = await supabase
            .from('document_knowledge')
            .insert(insertData);

          if (insertError) {
            console.error('Database insert error for chunk', i, ':', insertError);
            return new Response(
              JSON.stringify({ error: `Failed to store chunk ${i}: ${insertError.message}` }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
          }

          console.log('Successfully inserted chunk', i, ':', insertResult);
        }

        console.log(`Successfully processed ${chunks.length} chunks for ${document_name}`);

        return new Response(
          JSON.stringify({
            success: true,
            chunks_processed: chunks.length,
            document_name,
            text_extracted: textContent.length
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

      } catch (processingError) {
        console.error('Document processing error:', processingError);
        return new Response(
          JSON.stringify({ error: `Document processing failed: ${processingError.message}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    // --- Fallback for invalid input
    return new Response(
      JSON.stringify({ error: 'Invalid request format. Expected query_text or document processing parameters.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('Error in create-embedding function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
