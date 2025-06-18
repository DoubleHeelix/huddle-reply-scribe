import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  action: "generateReply" | "adjustTone" | "analyzeStyle";
  screenshotText?: string;
  userDraft?: string;
  principles?: string;
  isRegeneration?: boolean;
  originalReply?: string;
  selectedTone?: string;
  documentKnowledge?: Array<{
    document_name: string;
    content_chunk: string;
    similarity: number;
  }>;
  userId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      action,
      screenshotText,
      userDraft,
      principles,
      isRegeneration,
      originalReply,
      selectedTone,
      documentKnowledge,
      userId,
    }: RequestBody = await req.json();

    const cleanAction = action?.trim();
    console.log("🤖 DEBUG: Enhanced AI Suggestions - Action:", cleanAction);

    if (cleanAction === "generateReply") {
      console.log("📊 DEBUG: Generate reply request details:", {
        screenshotTextLength: screenshotText?.length || 0,
        userDraftLength: userDraft?.length || 0,
        principlesLength: principles?.length || 0,
        documentsProvided: documentKnowledge?.length || 0,
        isRegeneration,
      });

      // Get user from auth header
      const authHeader = req.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "");

      let userId = null;
      if (token) {
        const {
          data: { user },
        } = await supabase.auth.getUser(token);
        userId = user?.id;
        console.log("👤 DEBUG: User ID from token:", userId);
      }

      // Fetch user's style profile
      let contextFromStyleProfile = "";
      if (userId) {
        const { data: profile, error: profileError } = await supabase
          .from("user_style_profiles")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (profile) {
          console.log("🎨 DEBUG: Found user style profile:", profile);
          contextFromStyleProfile = `\n\nUser's typical writing style (for reference):\n- Average sentence length: ~${
            profile.avg_sentence_length
          } words.\n- Formality: ${
            profile.formality || "not set"
          }\n- Common topics: ${
            profile.common_topics?.join(", ") || "not set"
          }\n`;
        }
      }

      // Fetch similar past huddles from Supabase if available
      let similarHuddles = [];
      if (userId && !isRegeneration) {
        try {
          console.log("🔍 DEBUG: Fetching similar huddles from Supabase...");

          const embeddingResponse = await fetch(
            "https://api.openai.com/v1/embeddings",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${openaiApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                input: `${screenshotText} ${userDraft}`,
                model: "text-embedding-3-small",
              }),
            }
          );

          const embeddingData = await embeddingResponse.json();
          const embedding = embeddingData.data[0].embedding;

          const rpcParams = {
            query_embedding: embedding,
            match_threshold: 0.1,
            match_count: 3,
            p_user_id: userId,
          };
          console.log("🔍 DEBUG: Calling match_huddle_plays with params:", rpcParams);

          const { data, error } = await supabase.rpc('match_huddle_plays', rpcParams);

          if (error) {
            console.error("❌ DEBUG: RPC match_huddle_plays FAILED:", error);
          } else {
            similarHuddles = data || [];
            console.log(
              `✅ DEBUG: RPC match_huddle_plays SUCCEEDED. Found ${similarHuddles.length} huddles.`
            );
            if (similarHuddles.length > 0) {
              console.log("✅ DEBUG: Similar huddles found:", JSON.stringify(similarHuddles, null, 2));
            }
          }
        } catch (error) {
          console.error("❌ DEBUG: Error fetching similar huddles:", error);
        }
      }

      // Build context from similar huddles
      let contextFromPastHuddles = "";
      if (similarHuddles.length > 0) {
        console.log("🧠 DEBUG: Building context from past huddles...");
        contextFromPastHuddles =
          "\n\nHere are some similar past conversations and responses that worked well:\n";
        similarHuddles.forEach((huddle: any, index: number) => {
          contextFromPastHuddles += `\nExample ${index + 1}:\nContext: ${
            huddle.screenshot_text
          }\nDraft: ${huddle.user_draft}\nSuccessful Reply: ${
            huddle.final_reply || huddle.generated_reply
          }\n`;
        });
        contextFromPastHuddles +=
          "\nUse these examples to inform your response style and approach.\n";
        console.log(
          "✅ DEBUG: Past huddles context built, length:",
          contextFromPastHuddles.length
        );
      }

      // Build context from document knowledge
      let contextFromDocuments = "";
      if (documentKnowledge && documentKnowledge.length > 0) {
        console.log("📚 DEBUG: Building context from document knowledge...");
        console.log(
          "📚 DEBUG: Documents to use:",
          documentKnowledge.map((doc) => ({
            name: doc.document_name,
            similarity: (doc.similarity * 100).toFixed(1) + "%",
            contentLength: doc.content_chunk.length,
          }))
        );

        contextFromDocuments =
          "\n\nRelevant information from your knowledge documents:\n";
        documentKnowledge.forEach((doc, index) => {
          contextFromDocuments += `\nFrom ${doc.document_name} (relevance: ${(
            doc.similarity * 100
          ).toFixed(1)}%):\n${doc.content_chunk}\n`;
        });
        contextFromDocuments +=
          "\nUse this information to inform your response when relevant.\n";
        console.log(
          "✅ DEBUG: Document context built, length:",
          contextFromDocuments.length
        );
      } else {
        console.log("⚠️ DEBUG: No document knowledge provided to AI function");
      }

      // Generate AI response with enhanced context
      const systemPrompt = `You are an expert communication assistant that helps people craft perfect responses for conversations. Your goal is to help improve their draft messages to be more effective, clear, and engaging.

${
  principles ||
  "Follow huddle principles: Clarity, Connection, Brevity, Flow, Empathy. Be warm and natural."
}

${contextFromStyleProfile}

${contextFromPastHuddles}

${contextFromDocuments}

Given the conversation context and the user's draft, provide an improved version that:
1. Maintains the user's authentic voice and intent
2. Improves clarity and engagement
3. Follows the communication principles
4. Is appropriate for the conversation context
5. Incorporates relevant knowledge from documents when applicable
6. Feels natural and not over-engineered

Always respond with ONLY the improved message text, no explanations or additional commentary.`;

      const userPrompt = `Conversation context: ${screenshotText}

User's draft message: ${userDraft}

Please provide an improved version of this message:`;

      console.log("🤖 DEBUG: Sending request to OpenAI with context lengths:", {
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length,
        hasDocumentContext: contextFromDocuments.length > 0,
        hasPastHuddlesContext: contextFromPastHuddles.length > 0,
      });

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 500,
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(
          "❌ DEBUG: OpenAI API request failed with status:",
          response.status
        );
        console.error("❌ DEBUG: OpenAI API error response:", errorBody);
        throw new Error(
          `OpenAI API request failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (
        !data.choices ||
        data.choices.length === 0 ||
        !data.choices[0].message
      ) {
        console.error(
          "❌ DEBUG: OpenAI response is missing expected structure:",
          data
        );
        throw new Error("Invalid response structure from OpenAI API.");
      }

      const reply = data.choices[0].message.content.trim();

      console.log(
        "✅ DEBUG: OpenAI response received, reply length:",
        reply.length
      );

      // Format past huddles for frontend display
      const pastHuddlesForDisplay = similarHuddles;

      // Store in Supabase for future learning (background task)
      if (userId) {
        const storeInSupabase = async () => {
          try {
            console.log(
              "💾 DEBUG: Storing huddle in Supabase for future learning..."
            );
            const embeddingResponse = await fetch(
              "https://api.openai.com/v1/embeddings",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${openaiApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  input: `${screenshotText} ${userDraft}`,
                  model: "text-embedding-3-small",
                }),
              }
            );

            const embeddingData = await embeddingResponse.json();
            const embedding = embeddingData.data[0].embedding;

            const huddleToInsert = {
              user_id: userId,
              screenshot_text: screenshotText,
              user_draft: userDraft,
              generated_reply: reply,
              principles: principles || '',
              embedding: embedding,
            };
            console.log("💾 DEBUG: Attempting to insert huddle with embedding length:", embedding.length);

            const { error } = await supabase.from('huddle_plays').insert(huddleToInsert);

            if (error) {
              console.error("❌ DEBUG: INSERT into huddle_plays FAILED:", error);
            } else {
              console.log("✅ DEBUG: INSERT into huddle_plays SUCCEEDED.");
            }
          } catch (error) {
            console.error(
              "❌ DEBUG: Error storing in Supabase:",
              (error as Error).message
            );
          }
        };

        await storeInSupabase();
      }

      console.log("🎯 DEBUG: Returning response with:", {
        replyLength: reply.length,
        pastHuddlesCount: pastHuddlesForDisplay.length,
        documentKnowledgeCount: documentKnowledge?.length || 0,
      });

      return new Response(
        JSON.stringify({
          reply,
          pastHuddles: pastHuddlesForDisplay,
          documentKnowledge: documentKnowledge || [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } else if (cleanAction === "analyzeStyle") {
      if (!userId) {
        console.error("❌ DEBUG: analyzeStyle called without userId.");
        throw new Error("userId is required for style analysis");
      }

      console.log("🔬 DEBUG: [1/5] Starting style analysis for user:", userId);

      const { data: huddlePlays, error } = await supabase
        .from("huddle_plays")
        .select("user_draft")
        .eq("user_id", userId);

      if (error) {
        console.error("❌ DEBUG: [2/5] Error fetching huddle plays:", error);
        throw error;
      }
      console.log(
        `✅ DEBUG: [2/5] Found ${huddlePlays?.length || 0} huddle plays.`
      );

      if (!huddlePlays || huddlePlays.length === 0) {
        return new Response(
          JSON.stringify({ message: "No huddle plays found to analyze." }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const allDrafts = huddlePlays.map((p) => p.user_draft).join(" ");
      const sentences = allDrafts.match(/[^.!?]+[.!?]+/g) || [];
      const words = allDrafts.split(/\s+/).filter(Boolean);
      const totalWords = words.length;
      const totalSentences = sentences.length;
      const avgSentenceLength =
        totalSentences > 0 ? Math.round(totalWords / totalSentences) : 0;

      console.log("📊 DEBUG: [3/5] Calculated metrics:", {
        totalWords,
        totalSentences,
        avgSentenceLength,
      });

      const stopWords = new Set([
        "i",
        "me",
        "my",
        "myself",
        "we",
        "our",
        "ours",
        "ourselves",
        "you",
        "your",
        "yours",
        "yourself",
        "yourselves",
        "he",
        "him",
        "his",
        "himself",
        "she",
        "her",
        "hers",
        "herself",
        "it",
        "its",
        "itself",
        "they",
        "them",
        "their",
        "theirs",
        "themselves",
        "what",
        "which",
        "who",
        "whom",
        "this",
        "that",
        "these",
        "those",
        "am",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "have",
        "has",
        "had",
        "having",
        "do",
        "does",
        "did",
        "doing",
        "a",
        "an",
        "the",
        "and",
        "but",
        "if",
        "or",
        "because",
        "as",
        "until",
        "while",
        "of",
        "at",
        "by",
        "for",
        "with",
        "about",
        "against",
        "between",
        "into",
        "through",
        "during",
        "before",
        "after",
        "above",
        "below",
        "to",
        "from",
        "up",
        "down",
        "in",
        "out",
        "on",
        "off",
        "over",
        "under",
        "again",
        "further",
        "then",
        "once",
        "here",
        "there",
        "when",
        "where",
        "why",
        "how",
        "all",
        "any",
        "both",
        "each",
        "few",
        "more",
        "most",
        "other",
        "some",
        "such",
        "no",
        "nor",
        "not",
        "only",
        "own",
        "same",
        "so",
        "than",
        "too",
        "very",
        "s",
        "t",
        "can",
        "will",
        "just",
        "don",
        "should",
        "now",
      ]);
      const wordFrequencies: { [key: string]: number } = {};
      words.forEach((word) => {
        const lowerWord = word.toLowerCase().replace(/[^a-z]/g, "");
        if (lowerWord && !stopWords.has(lowerWord)) {
          wordFrequencies[lowerWord] = (wordFrequencies[lowerWord] || 0) + 1;
        }
      });
      const commonTopics = Object.entries(wordFrequencies)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([text]) => text);

      console.log("✅ DEBUG: [4/5] Extracted common topics:", commonTopics);

      const profileData = {
        user_id: userId,
        huddle_count: huddlePlays.length,
        avg_sentence_length: avgSentenceLength,
        common_topics: commonTopics,
        updated_at: new Date().toISOString(),
      };

      console.log(
        "💾 DEBUG: [5/5] Attempting to save profile data:",
        profileData
      );

      // Two-step upsert to avoid RLS issues with onConflict
      const { data: existingProfile, error: selectError } = await supabase
        .from("user_style_profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (selectError && selectError.code !== "PGRST116") {
        // Ignore 'not found' error
        console.error(
          "❌ DEBUG: [5/5] Error checking for existing profile:",
          selectError
        );
        throw selectError;
      }

      let updatedProfile;
      if (existingProfile) {
        // Update existing profile
        const { data, error: updateError } = await supabase
          .from("user_style_profiles")
          .update(profileData)
          .eq("user_id", userId)
          .select()
          .single();
        if (updateError) {
          console.error("❌ DEBUG: [5/5] Error updating profile:", updateError);
          throw updateError;
        }
        updatedProfile = data;
      } else {
        // Insert new profile
        const { data, error: insertError } = await supabase
          .from("user_style_profiles")
          .insert(profileData)
          .select()
          .single();
        if (insertError) {
          console.error(
            "❌ DEBUG: [5/5] Error inserting profile:",
            insertError
          );
          throw insertError;
        }
        updatedProfile = data;
      }

      console.log("✅ DEBUG: Style analysis complete and profile updated.");

      return new Response(JSON.stringify(updatedProfile), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (cleanAction === "adjustTone") {
      // Tone adjustment logic (same as before)
      const toneInstructions = {
        casual: "Make this more casual and relaxed in tone",
        professional: "Make this more professional and formal",
        friendly: "Make this warmer and more friendly",
        direct: "Make this more direct and to the point",
        warm: "Make this warmer and more empathetic",
        confident: "Make this more confident and assertive",
        curious: "Make this more curious and inquisitive",
      };

      const instruction =
        toneInstructions[selectedTone as keyof typeof toneInstructions];
      if (!instruction) {
        return new Response(JSON.stringify({ reply: originalReply }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `${instruction}. Keep the core message and meaning intact, just adjust the tone. Respond with only the adjusted message, no explanations.`,
              },
              {
                role: "user",
                content: originalReply,
              },
            ],
            temperature: 0.7,
            max_tokens: 500,
          }),
        }
      );

      const data = await response.json();
      const adjustedReply = data.choices[0].message.content.trim();

      return new Response(JSON.stringify({ reply: adjustedReply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error(
      `Invalid action received: '${cleanAction}'. Check for deployment issues.`
    );
  } catch (error) {
    console.error(
      "❌ DEBUG: Error in enhanced-ai-suggestions function:",
      error
    );
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
