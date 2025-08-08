import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { stopWords } from "../shared/stopWords.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------- Phrase extraction utilities ----------
function normalizeAndTokenize(input: string): string[] {
  // Keep letters, digits, intra-word apostrophes/hyphens; split on whitespace
  const cleaned = input
    .toLowerCase()
    .replace(/[_*#@()[\]{}|\\/:;“”"’`,<>~^]/g, " ") // punctuation to spaces
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  // Split to tokens and strip leading/trailing punctuation like .!? and commas
  return cleaned
    .split(" ")
    .map((t) => t.replace(/^[.!?;,]+|[.!?;,]+$/g, ""))
    .filter(Boolean);
}

function removeStopWords(tokens: string[], stop: Set<string>): string[] {
  return tokens.filter((t) => {
    // filter very short tokens and pure numbers
    if (t.length < 2) return false;
    if (/^\d+$/.test(t)) return false;
    return !stop.has(t);
  });
}

function ngrams(tokens: string[], n: number): string[] {
  const grams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    const gramTokens = tokens.slice(i, i + n);
    // skip n-grams that are entirely stop words or contain empty tokens
    const allStop = gramTokens.every((t) => stopWords.has(t));
    if (allStop) continue;
    grams.push(gramTokens.join(" "));
  }
  return grams;
}

function topN(items: string[], n: number): string[] {
  const freq = new Map<string, number>();
  for (const it of items) {
    freq.set(it, (freq.get(it) || 0) + 1);
  }
  const sorted = Array.from(freq.entries())
    // Sort by frequency desc, then lexicographically for stability
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([k]) => k);
  return sorted;
}

function extractCommonPhrases(
  texts: string[],
  options?: { top?: number }
): { bigrams: string[]; trigrams: string[] } {
  const top = options?.top ?? 20;

  // Concatenate texts; alternatively process per-text to preserve boundaries
  const combined = texts.join(" ");
  const tokens = normalizeAndTokenize(combined);
  // For phrase style, we remove stop words before building n-grams to emphasize content words
  const contentTokens = removeStopWords(tokens, stopWords);

  const bigramsAll = ngrams(contentTokens, 2);
  const trigramsAll = ngrams(contentTokens, 3);

  const bigramsTop = topN(bigramsAll, top);
  const trigramsTop = topN(trigramsAll, top);

  return { bigrams: bigramsTop, trigrams: trigramsTop };
}
// -------------------------------------------------

interface RequestBody {
  action:
    | "generateReply"
    | "adjustTone"
    | "analyzeStyle"
    | "confirmAndSaveStyle";
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
  analysisData?: any;
}

serve(async (req: Request) => {
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
      analysisData,
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

          // Include common phrases (bigrams/trigrams) if present
          const phrases = (profile as any).common_phrases || {};
          const bigrams: string[] = Array.isArray(phrases.bigrams) ? phrases.bigrams.slice(0, 10) : [];
          const trigrams: string[] = Array.isArray(phrases.trigrams) ? phrases.trigrams.slice(0, 10) : [];
          const formattedBigrams = bigrams.length ? bigrams.join(" | ") : "not set";
          const formattedTrigrams = trigrams.length ? trigrams.join(" | ") : "not set";

          contextFromStyleProfile = `

User's typical writing style (for reference):
- Average sentence length: ~${profile.avg_sentence_length} words.
- Formality: ${profile.formality || "not set"}
- Common topics: ${profile.common_topics?.join(", ") || "not set"}
- Common phrases (bigrams): ${formattedBigrams}
- Common phrases (trigrams): ${formattedTrigrams}
`;
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
          console.log(
            "🔍 DEBUG: Calling match_huddle_plays with params:",
            rpcParams
          );

          const { data, error } = await supabase.rpc(
            "match_huddle_plays",
            rpcParams
          );

          if (error) {
            console.error("❌ DEBUG: RPC match_huddle_plays FAILED:", error);
          } else {
            similarHuddles = data || [];
            console.log(
              `✅ DEBUG: RPC match_huddle_plays SUCCEEDED. Found ${similarHuddles.length} huddles.`
            );
            if (similarHuddles.length > 0) {
              console.log(
                "✅ DEBUG: Similar huddles found:",
                JSON.stringify(similarHuddles, null, 2)
              );
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
      const systemPrompt = `You are an expert writing partner helping users improve their draft messages.
      
      Your Goal:
      - Refine the user’s draft so it’s clearer, more engaging, and more effective—without changing their original intent or voice.

      Style Guidance (Very Important):
      - Match the user's tone, phrasing, and personality using their style profile below.
      - Prefer the user's typical phrases (bigrams/trigrams) when they fit naturally; do not force them and avoid overusing them.
      - If a phrase would sound awkward or repetitive in context, do not use it.

      Context Tools:
      1) Style Profile:
         ${contextFromStyleProfile}

      2) Knowledge Base:
         If the conversation or draft includes a question, concern, or knowledge gap, weave in relevant document insights naturally, in the user’s style.
         ${contextFromDocuments}

      3) Past Successes:
         Learn from messages that worked well for this user.
         ${contextFromPastHuddles}

      Output Rules:
      - Only return the final, refined message—no commentary, no quotation marks.
      - The result should feel organic and human, not over-engineered.
      - Prioritize clarity, connection, and authenticity.`;

      const userPrompt = `Conversation context: ${screenshotText}

User's draft message: "${userDraft}"

Refine this draft to make it better:`;

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
        // Quality check: Only store huddles with a meaningful draft
        const wordCount = userDraft?.split(/\s+/).filter(Boolean).length || 0;
        if (wordCount >= 3) {
          const storeInSupabase = async () => {
            try {
              console.log(
                `💾 DEBUG: Storing huddle (draft word count: ${wordCount}) in Supabase...`
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
                principles: principles || "",
                embedding: embedding,
              };
              console.log(
                "💾 DEBUG: Attempting to insert huddle with embedding length:",
                embedding.length
              );

              const { error } = await supabase
                .from("huddle_plays")
                .insert(huddleToInsert);

              if (error) {
                console.error(
                  "❌ DEBUG: INSERT into huddle_plays FAILED:",
                  error
                );
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
        } else {
          console.log(
            `⚠️ DEBUG: Huddle not stored. Draft word count (${wordCount}) is below the threshold of 3.`
          );
        }
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

      console.log("🔬 DEBUG: [1/6] Starting style analysis for user:", userId);

      // Fetch latest 200 user-authored drafts from huddle_plays
      const { data: huddlePlays, error } = await supabase
        .from("huddle_plays")
        .select("user_draft, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("❌ DEBUG: [2/6] Error fetching huddle plays:", error);
        throw error;
      }
      console.log(
        `✅ DEBUG: [2/6] Found ${huddlePlays?.length || 0} recent huddle plays.`
      );

      if (!huddlePlays || huddlePlays.length === 0) {
        return new Response(
          JSON.stringify({ message: "No huddle plays found to analyze." }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Aggregate drafts
      const draftsArray = huddlePlays
        .map((p: { user_draft: string }) => (p.user_draft || "").trim())
        .filter(Boolean);

      const allDrafts = draftsArray.join(" ");
      const sentences = allDrafts.match(/[^.!?]+[.!?]+/g) || [];
      const words = allDrafts.split(/\s+/).filter(Boolean);
      const totalWords = words.length;
      const totalSentences = sentences.length;
      const avgSentenceLength =
        totalSentences > 0 ? Math.round(totalWords / totalSentences) : 0;

      console.log("📊 DEBUG: [3/6] Calculated metrics:", {
        totalWords,
        totalSentences,
        avgSentenceLength,
      });

      // Unigrams -> common topics (existing behavior)
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

      // NEW: Phrase extraction (bigrams/trigrams) from latest 200 drafts
      const { bigrams, trigrams } = extractCommonPhrases(draftsArray, { top: 20 });
      console.log("🧩 DEBUG: [4/6] Extracted phrases:", {
        bigramsCount: bigrams.length,
        trigramsCount: trigrams.length,
        sampleBigrams: bigrams.slice(0, 5),
        sampleTrigrams: trigrams.slice(0, 5),
      });

      const analysisResult = {
        huddle_count: huddlePlays.length,
        avg_sentence_length: avgSentenceLength,
        common_topics: commonTopics,
        // Include phrases in analysis result so the client can confirm/save
        common_phrases: {
          bigrams,
          trigrams,
        },
      };

      console.log("✅ DEBUG: [5/6] Style analysis complete (including phrases).");

      return new Response(JSON.stringify(analysisResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (cleanAction === "confirmAndSaveStyle") {
      console.log("💾 DEBUG: Starting confirmAndSaveStyle for user:", userId);
      if (!userId || !analysisData) {
        throw new Error(
          "userId and analysisData are required for saving style"
        );
      }

      // Ensure phrases are present in the payload; if not, we can recompute quickly from latest drafts
      let profileData = {
        ...analysisData,
        user_id: userId,
        updated_at: new Date().toISOString(),
      } as any;

      if (!profileData.common_phrases) {
        console.log("ℹ️ DEBUG: common_phrases missing in analysisData; recomputing from latest drafts...");
        const { data: latestDrafts, error: latestErr } = await supabase
          .from("huddle_plays")
          .select("user_draft, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(200);
        if (latestErr) {
          console.error("❌ DEBUG: Error fetching drafts for phrase recompute:", latestErr);
        } else {
          const drafts = (latestDrafts || [])
            .map((p: { user_draft: string }) => (p.user_draft || "").trim())
            .filter(Boolean);
          const { bigrams, trigrams } = extractCommonPhrases(drafts, { top: 20 });
          profileData.common_phrases = { bigrams, trigrams };
        }
      }

      console.log("💾 DEBUG: Upserting profile data:", profileData);

      const { data, error } = await supabase
        .from("user_style_profiles")
        .upsert(profileData, { onConflict: "user_id" })
        .select()
        .single();

      if (error) {
        console.error("❌ DEBUG: Error upserting profile:", error);
        throw error;
      }

      console.log("✅ DEBUG: Profile saved successfully.");
      return new Response(JSON.stringify(data), {
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
