import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  action: 'generateReply' | 'adjustTone';
  screenshotText?: string;
  userDraft?: string;
  principles?: string;
  isRegeneration?: boolean;
  originalReply?: string;
  selectedTone?: string;
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
    const qdrantApiKey = Deno.env.get('QDRANT_API_KEY');
    const qdrantUrl = Deno.env.get('QDRANT_URL');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, screenshotText, userDraft, principles, isRegeneration, originalReply, selectedTone }: RequestBody = await req.json();

    console.log('Enhanced AI Suggestions - Action:', action);

    if (action === 'generateReply') {
      // Get user from auth header
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');
      
      let userId = null;
      if (token) {
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id;
      }

      // Fetch similar past huddles from Qdrant if available
      let similarHuddles = [];
      if (qdrantApiKey && qdrantUrl && userId && !isRegeneration) {
        try {
          console.log('Fetching similar huddles from Qdrant...');
          
          // Create embedding for current context
          const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              input: `${screenshotText} ${userDraft}`,
              model: 'text-embedding-3-small'
            }),
          });

          const embeddingData = await embeddingResponse.json();
          const embedding = embeddingData.data[0].embedding;

          // Search for similar vectors in Qdrant
          const qdrantResponse = await fetch(`${qdrantUrl}/collections/huddle_plays/points/search`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${qdrantApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              vector: embedding,
              limit: 3,
              score_threshold: 0.7,
              filter: {
                must: [
                  {
                    key: 'user_id',
                    match: { value: userId }
                  }
                ]
              }
            }),
          });

          if (qdrantResponse.ok) {
            const qdrantData = await qdrantResponse.json();
            similarHuddles = qdrantData.result || [];
            console.log(`Found ${similarHuddles.length} similar huddles`);
          }
        } catch (error) {
          console.error('Error fetching from Qdrant:', error);
        }
      }

      // Search for relevant document knowledge using the new function
      let documentKnowledge = [];
      if (userId && !isRegeneration) {
        try {
          console.log('Searching document knowledge...');
          
          // Create embedding for document search
          const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              input: `${screenshotText} ${userDraft}`,
              model: 'text-embedding-3-small'
            }),
          });

          const embeddingData = await embeddingResponse.json();
          const embedding = embeddingData.data[0].embedding;

          // Search for similar document chunks
          const { data: docResults, error: docError } = await supabase
            .rpc('search_document_knowledge', {
              query_embedding: embedding,
              target_user_id: userId,
              match_threshold: 0.7,
              match_count: 3
            });

          if (!docError && docResults) {
            documentKnowledge = docResults;
            console.log(`Found ${documentKnowledge.length} relevant document chunks`);
          }
        } catch (error) {
          console.error('Error searching document knowledge:', error);
        }
      }

      // Build context from similar huddles
      let contextFromPastHuddles = '';
      if (similarHuddles.length > 0) {
        contextFromPastHuddles = '\n\nHere are some similar past conversations and responses that worked well:\n';
        similarHuddles.forEach((huddle: any, index: number) => {
          const payload = huddle.payload;
          contextFromPastHuddles += `\nExample ${index + 1}:\nContext: ${payload.screenshot_text}\nDraft: ${payload.user_draft}\nSuccessful Reply: ${payload.final_reply || payload.generated_reply}\n`;
        });
        contextFromPastHuddles += '\nUse these examples to inform your response style and approach.\n';
      }

      // Build context from document knowledge
      let contextFromDocuments = '';
      if (documentKnowledge.length > 0) {
        contextFromDocuments = '\n\nRelevant information from your knowledge base:\n';
        documentKnowledge.forEach((doc: any, index: number) => {
          contextFromDocuments += `\nDocument "${doc.document_name}" (relevance: ${(doc.similarity * 100).toFixed(1)}%):\n${doc.content_chunk}\n`;
        });
        contextFromDocuments += '\nUse this information to provide more informed and accurate responses.\n';
      }

      // Generate AI response with context
      const systemPrompt = `You are an expert communication assistant that helps people craft perfect responses for conversations. Your goal is to help improve their draft messages to be more effective, clear, and engaging.

${principles || 'Follow huddle principles: Clarity, Connection, Brevity, Flow, Empathy. Be warm and natural.'}

${contextFromPastHuddles}

${contextFromDocuments}

Given the conversation context and the user's draft, provide an improved version that:
1. Maintains the user's authentic voice and intent
2. Improves clarity and engagement
3. Follows the communication principles
4. Is appropriate for the conversation context
5. Feels natural and not over-engineered
6. Incorporates relevant knowledge from documents when applicable

Always respond with ONLY the improved message text, no explanations or additional commentary.`;

      const userPrompt = `Conversation context: ${screenshotText}

User's draft message: ${userDraft}

Please provide an improved version of this message:`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      const data = await response.json();
      const reply = data.choices[0].message.content.trim();

      // Prepare sources for the response
      const sources = {
        huddles: similarHuddles.map((huddle: any) => ({
          id: huddle.id,
          screenshot_text: huddle.payload.screenshot_text,
          user_draft: huddle.payload.user_draft,
          final_reply: huddle.payload.final_reply || huddle.payload.generated_reply,
          similarity: huddle.score
        })),
        documents: documentKnowledge.map((doc: any) => ({
          id: doc.id,
          document_name: doc.document_name,
          content_chunk: doc.content_chunk,
          similarity: doc.similarity
        }))
      };

      // Store in Qdrant for future learning (background task)
      if (qdrantApiKey && qdrantUrl && userId) {
        const storeInQdrant = async () => {
          try {
            console.log('Storing huddle in Qdrant for future learning...');
            
            // Create embedding for storage
            const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                input: `${screenshotText} ${userDraft}`,
                model: 'text-embedding-3-small'
              }),
            });

            const embeddingData = await embeddingResponse.json();
            const embedding = embeddingData.data[0].embedding;

            // Store in Qdrant
            const pointId = `${userId}_${Date.now()}`;
            await fetch(`${qdrantUrl}/collections/huddle_plays/points/upsert`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${qdrantApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                points: [{
                  id: pointId,
                  vector: embedding,
                  payload: {
                    user_id: userId,
                    screenshot_text: screenshotText,
                    user_draft: userDraft,
                    generated_reply: reply,
                    principles: principles || '',
                    created_at: new Date().toISOString()
                  }
                }]
              }),
            });

            console.log('Successfully stored in Qdrant');
          } catch (error) {
            console.error('Error storing in Qdrant:', error);
          }
        };

        // Run as background task
        storeInQdrant();
      }

      return new Response(
        JSON.stringify({ reply, sources }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );

    } else if (action === 'adjustTone') {
      // Tone adjustment logic (same as before)
      const toneInstructions = {
        casual: 'Make this more casual and relaxed in tone',
        professional: 'Make this more professional and formal',
        friendly: 'Make this warmer and more friendly',
        direct: 'Make this more direct and to the point',
        warm: 'Make this warmer and more empathetic',
        confident: 'Make this more confident and assertive',
        curious: 'Make this more curious and inquisitive'
      };

      const instruction = toneInstructions[selectedTone as keyof typeof toneInstructions];
      if (!instruction) {
        return new Response(
          JSON.stringify({ reply: originalReply }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `${instruction}. Keep the core message and meaning intact, just adjust the tone. Respond with only the adjusted message, no explanations.`
            },
            {
              role: 'user',
              content: originalReply
            }
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      const data = await response.json();
      const adjustedReply = data.choices[0].message.content.trim();

      return new Response(
        JSON.stringify({ reply: adjustedReply }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error in enhanced-ai-suggestions function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
