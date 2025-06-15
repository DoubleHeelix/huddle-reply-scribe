
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
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase configuration missing');
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestBody = await req.json();
    console.log('Request body keys:', Object.keys(requestBody));

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

    // Handle document processing
    if (requestBody.document_name && requestBody.document_content && requestBody.user_id) {
      const { document_name, document_content, user_id } = requestBody;
      
      console.log('Processing document:', document_name, 'for user:', user_id);

      try {
        // Decode base64 content
        const decodedContent = atob(document_content);
        console.log('Decoded content length:', decodedContent.length);
        
        // Extract text content from PDF
        let textContent = '';
        
        // Simple text extraction - look for readable text patterns
        const lines = decodedContent.split('\n');
        for (const line of lines) {
          // Skip lines that are mostly binary data or have too many control characters
          const readableText = line.replace(/[^\x20-\x7E\s]/g, '').trim();
          if (readableText.length > 10 && readableText.length > line.length * 0.3) {
            textContent += readableText + ' ';
          }
        }

        if (textContent.length < 50) {
          console.error('Could not extract sufficient text from PDF');
          return new Response(
            JSON.stringify({ error: 'Could not extract text from PDF. Please ensure the PDF contains readable text.' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          );
        }

        console.log('Extracted text length:', textContent.length);
        
        // Create chunks from the extracted text
        const chunkSize = 1000;
        const chunks = [];
        
        for (let i = 0; i < textContent.length; i += chunkSize) {
          const chunk = textContent.slice(i, i + chunkSize).trim();
          if (chunk.length > 10) { // Only add meaningful chunks
            chunks.push(chunk);
          }
        }

        console.log(`Created ${chunks.length} chunks from document`);

        if (chunks.length === 0) {
          return new Response(
            JSON.stringify({ error: 'No meaningful text content found in the document' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          );
        }

        // Process each chunk
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          
          console.log(`Processing chunk ${i + 1}/${chunks.length}, length: ${chunk.length}`);
          
          // Create embedding for chunk
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
            console.error('OpenAI API error for chunk:', embeddingResponse.status, errorData);
            return new Response(
              JSON.stringify({ error: `OpenAI API error for chunk ${i}: ${embeddingResponse.status} - ${errorData}` }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500 
              }
            );
          }

          const embeddingData = await embeddingResponse.json();
          const embedding = embeddingData.data[0].embedding;

          // Store in database - ensuring chunk_index is set as a direct column
          const insertData = {
            user_id,
            document_name,
            content_chunk: chunk,
            embedding,
            chunk_index: i, // This must be set as a direct property, not in metadata
            metadata: {
              total_chunks: chunks.length,
              chunk_size: chunk.length,
              original_document_size: decodedContent.length
            }
          };

          console.log('Inserting data for chunk', i, 'with chunk_index:', insertData.chunk_index);

          const { error: insertError } = await supabase
            .from('document_knowledge')
            .insert(insertData);

          if (insertError) {
            console.error('Database insert error for chunk', i, ':', insertError);
            return new Response(
              JSON.stringify({ error: `Failed to store chunk ${i}: ${insertError.message}` }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500 
              }
            );
          }

          console.log('Successfully inserted chunk', i);
        }

        console.log(`Successfully processed ${chunks.length} chunks for ${document_name}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            chunks_processed: chunks.length,
            document_name,
            text_extracted: textContent.length
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );

      } catch (processingError) {
        console.error('Document processing error:', processingError);
        return new Response(
          JSON.stringify({ error: `Document processing failed: ${processingError.message}` }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid request format. Expected query_text or document processing parameters.' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );

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
