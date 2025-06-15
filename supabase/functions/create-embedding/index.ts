
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
    console.log('🚀 Edge function started');

    // Validate environment variables
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('❌ OpenAI API key not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase configuration missing');
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('📥 Request received with keys:', Object.keys(requestBody));
    } catch (err) {
      console.error('❌ Failed to parse JSON body:', err);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // SEARCH FLOW - Generate embedding for search queries
    if (requestBody.query_text) {
      const { query_text } = requestBody;
      
      console.log('🔍 Creating embedding for search query');

      try {
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
          console.error('❌ OpenAI API error:', response.status, errorData);
          return new Response(
            JSON.stringify({ error: `OpenAI API error: ${response.status}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        const data = await response.json();
        const embedding = data.data[0].embedding;

        console.log('✅ Search embedding generated successfully');
        return new Response(
          JSON.stringify({ embedding }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (error) {
        console.error('❌ Error generating search embedding:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to generate search embedding' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    // DOCUMENT PROCESSING FLOW - Process extracted text
    if (requestBody.document_name && requestBody.extracted_text && requestBody.user_id) {
      const { document_name, extracted_text, user_id, metadata } = requestBody;
      
      console.log('📄 Processing document:', document_name, 'for user:', user_id);
      console.log('📝 Text length:', extracted_text.length);

      // Validate inputs
      if (typeof extracted_text !== 'string' || extracted_text.length < 50) {
        console.error('❌ Invalid or insufficient text content');
        return new Response(
          JSON.stringify({ error: 'Text content is too short or invalid' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      try {
        // Create text chunks
        const chunkSize = 1000;
        const chunks = [];
        
        for (let i = 0; i < extracted_text.length; i += chunkSize) {
          const chunk = extracted_text.slice(i, i + chunkSize).trim();
          if (chunk.length > 50) { // Only include meaningful chunks
            chunks.push(chunk);
          }
        }

        console.log(`📦 Created ${chunks.length} chunks from document`);

        if (chunks.length === 0) {
          return new Response(
            JSON.stringify({ error: 'No meaningful text chunks could be created' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Process each chunk
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          console.log(`🔄 Processing chunk ${i + 1}/${chunks.length}`);

          try {
            // Generate embedding
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
              console.error(`❌ OpenAI API error for chunk ${i}:`, errorData);
              throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
            }

            const embeddingData = await embeddingResponse.json();
            const embedding = embeddingData.data[0].embedding;

            // Store in database with all required fields
            const insertData = {
              user_id,
              document_name,
              content_chunk: chunk,
              embedding,
              chunk_index: i,
              metadata: {
                ...metadata,
                total_chunks: chunks.length,
                chunk_size: chunk.length,
                created_at: new Date().toISOString()
              }
            };

            console.log(`💾 Storing chunk ${i} in database`);

            const { error: insertError } = await supabase
              .from('document_knowledge')
              .insert(insertData);

            if (insertError) {
              console.error(`❌ Database insert error for chunk ${i}:`, insertError);
              throw new Error(`Database error: ${insertError.message}`);
            }

            console.log(`✅ Chunk ${i + 1} processed and stored successfully`);

          } catch (chunkError) {
            console.error(`❌ Error processing chunk ${i}:`, chunkError);
            return new Response(
              JSON.stringify({ error: `Failed to process chunk ${i}: ${chunkError.message}` }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
          }
        }

        console.log(`🎉 Successfully processed all ${chunks.length} chunks for ${document_name}`);

        return new Response(
          JSON.stringify({
            success: true,
            chunks_processed: chunks.length,
            document_name,
            text_length: extracted_text.length
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

      } catch (error) {
        console.error('❌ Document processing error:', error);
        return new Response(
          JSON.stringify({ error: `Document processing failed: ${error.message}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    // Invalid request format
    console.error('❌ Invalid request format');
    return new Response(
      JSON.stringify({ error: 'Invalid request format. Expected query_text or document processing parameters.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('❌ Edge function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
