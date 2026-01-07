
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import supabaseJs from 'https://esm.sh/@supabase/supabase-js@2.50.0/dist/umd/supabase.js?target=deno&deno-std=0.168.0';

const { createClient } = supabaseJs;

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
      console.log('📥 Request received:', JSON.stringify(requestBody, null, 2));
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

    // DOCUMENT PROCESSING FLOW - Check for all required fields
    if (requestBody.document_name && requestBody.extracted_text && requestBody.user_id) {
      const { document_name, extracted_text, user_id, metadata } = requestBody;
      
      console.log('📄 Processing document:', document_name, 'for user:', user_id);
      console.log('📝 Text content:', extracted_text);
      console.log('📝 Text length:', extracted_text.length);

      // Basic validation
      if (typeof extracted_text !== 'string' || extracted_text.trim().length === 0) {
        console.error('❌ Invalid text content');
        return new Response(
          JSON.stringify({ error: 'Text content is invalid or empty' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      try {
        const textToProcess = extracted_text.trim();
        
        console.log('🔄 Processing single text chunk from client');

        // Generate embedding
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: textToProcess,
            model: 'text-embedding-3-small'
          }),
        });

        if (!embeddingResponse.ok) {
          const errorData = await embeddingResponse.text();
          console.error('❌ OpenAI API error:', embeddingResponse.status, errorData);
          return new Response(
            JSON.stringify({ error: `OpenAI API error: ${embeddingResponse.status}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        console.log('💾 Storing document chunk in database');

        // Store in database
        const { error: insertError } = await supabase
          .from('document_knowledge')
          .insert({
            user_id,
            document_name,
            content_chunk: textToProcess,
            embedding,
            chunk_index: requestBody.chunk_index || 0,
            metadata: {
              ...metadata,
              total_chunks: requestBody.total_chunks || 1,
              chunk_size: textToProcess.length,
              created_at: new Date().toISOString()
            }
          });

        if (insertError) {
          console.error('❌ Database insert error:', insertError);
          return new Response(
            JSON.stringify({ error: `Database error: ${insertError.message}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        console.log('🎉 Document chunk processed successfully');

        return new Response(
          JSON.stringify({
            success: true,
            chunks_processed: 1,
            document_name,
            text_length: textToProcess.length
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
    console.error('❌ Invalid request format - missing required fields');
    console.log('Available fields:', Object.keys(requestBody));
    return new Response(
      JSON.stringify({ 
        error: 'Invalid request format. Expected query_text for search or document_name, extracted_text, and user_id for processing.',
        received_fields: Object.keys(requestBody)
      }),
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

// Helper function to split text into chunks
