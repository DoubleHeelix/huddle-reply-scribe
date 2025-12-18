import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

const allowedOrigins = [
  "http://localhost:8080",
  "https://localhost:8080",
  "https://huddle-reply-scribe-production.up.railway.app",
  // Add your mobile device's local IP if needed, e.g., 'http://192.168.1.100:8080'
];

function formatStyleFingerprintSummary(
  fingerprint?: {
    emoji_rate_per_message?: number;
    emoji_message_share?: number;
    exclamation_per_sentence?: number;
    question_per_sentence?: number;
    uppercase_word_ratio?: number;
    typical_word_count?: number;
    typical_char_count?: number;
    slang_examples?: string[];
    greetings?: string[];
    closings?: string[];
  } | null
): string {
  if (!fingerprint) return "";
  const parts: string[] = [];

  if (fingerprint.typical_word_count) {
    parts.push(`Keep length around ~${fingerprint.typical_word_count} words (${fingerprint.typical_char_count || 0} chars).`);
  }
  if (fingerprint.emoji_rate_per_message !== undefined) {
    parts.push(
      `Emoji: ~${fingerprint.emoji_rate_per_message} per message, used in ${
        fingerprint.emoji_message_share !== undefined ? Math.round((fingerprint.emoji_message_share || 0) * 100) : 0
      }% of messages.`
    );
  }
  if (fingerprint.exclamation_per_sentence !== undefined || fingerprint.question_per_sentence !== undefined) {
    parts.push(
      `Punctuation lean: exclamations ${fingerprint.exclamation_per_sentence ?? 0}/sentence, questions ${
        fingerprint.question_per_sentence ?? 0
      }/sentence.`
    );
  }
  if (fingerprint.uppercase_word_ratio !== undefined) {
    parts.push(`Uppercase words ${(fingerprint.uppercase_word_ratio * 100 || 0).toFixed(0)}% of the time.`);
  }
  if (fingerprint.slang_examples && fingerprint.slang_examples.length) {
    parts.push(`Slang to prefer if natural: ${fingerprint.slang_examples.join(", ")}.`);
  }
  if ((fingerprint.greetings && fingerprint.greetings.length) || (fingerprint.closings && fingerprint.closings.length)) {
    const greetingText = fingerprint.greetings && fingerprint.greetings.length ? `greetings (${fingerprint.greetings.join(", ")})` : "";
    const closingText = fingerprint.closings && fingerprint.closings.length ? `closings (${fingerprint.closings.join(", ")})` : "";
    parts.push(`Open/close habits: ${[greetingText, closingText].filter(Boolean).join("; ")}.`);
  }

  return parts.join(" ");
}

serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin") || "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Function started, checking API key...");

    if (!openAIApiKey) {
      console.error("OpenAI API key not found");
      throw new Error("OpenAI API key not configured");
    }

    const { storyText, imageUrl, userId, count = 3 } = await req.json();

    console.log("Generating story interruptions for:", {
      hasText: !!storyText,
      hasImage: !!imageUrl,
      count,
    });

    // Fetch user's style profile from Supabase
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: styleProfile, error: styleError } = await supabase
      .from("user_style_profiles")
      .select("style_description, style_fingerprint")
      .eq("user_id", userId)
      .single();

    if (styleError) {
      console.error("Error fetching user style profile:", styleError);
      // Continue without style profile for now, or handle error as needed
    }

    const fingerprintSummary = formatStyleFingerprintSummary(
      styleProfile?.style_fingerprint as Record<string, unknown> | undefined
    );

    const styleInstruction = styleProfile?.style_description
      ? `Your primary instruction is to adopt the following writing style: ${styleProfile.style_description}. Mirror the user's phrasing and cadence; if this conflicts with other rules, prefer this style.${
          fingerprintSummary ? ` Cadence notes: ${fingerprintSummary}` : ""
        }`
      : "You are an observant and thoughtful friend crafting Instagram story replies. Your goal is to start genuine, warm, and curious conversations based strictly on the visible content. Always reference what's actually there—no guessing or speculation. Keep replies authentic, friendly, and simple. Use at most one emoji, only if it fits naturally.";

    const contextFromStyleProfile = styleProfile?.style_description
      ? `${styleProfile.style_description}${fingerprintSummary ? `\n${fingerprintSummary}` : ""}`
      : "Default: Be observant, thoughtful, and curious. Keep it simple and authentic.";

    const systemPrompt = {
      system: styleInstruction,
      version: styleProfile ? "Custom" : "Default",
      stylePath: styleProfile ? "custom" : "default",
    };

    const userPromptHeader = "A friend posted an Instagram story.";
    const storyContentLine =
      storyText && storyText.trim()
        ? `Story Content: ${storyText.trim()}`
        : "Story Content: This is an IMAGE. First, silently list 3-5 visible objects or activities, pick one, then write the reply anchored to that visible element.";

    const baseUserPrompt = `A friend posted this on their story:
- ${storyContentLine}

Your goal is to spark a short back-and-forth (not just praise) and end with a natural, specific question about the visible element.

Style: Write in the user's natural style. ${contextFromStyleProfile}

Rules:
- Keep it 1 sentence (or 2 very short), 5–18 words, friendly not gushy, never salesy.
- Be based strictly on visible details (text or image). Never guess what’s not shown.
- If the image is unclear, keep it simple and positive.
- If content is too vague to anchor on something visible, ask a gentle clarifying question about what they're up to.
- For images: before writing, silently list 3–5 visible objects/activities, pick one, and reference it.
- Emoji discipline: use zero emojis unless clearly additive; if used, only one and avoid 🚀🥳🔥.
- End with a natural, specific, open-ended question about the visible element.
- Avoid references to bodies/appearance, politics, religion, sponsorships, or asking for DMs.
- Use straightforward terms for pets (e.g., "your dog" not "fur baby").
- Ignore overlays, UI elements, or music tags.
- Output one plain-text reply (no lists, numbering, quotes, or markdown).`;
    // Prepare messages for API
    type Message = {
      role: "system" | "user";
      content:
        | string
        | { type: string; text?: string; image_url?: { url: string } }[];
    };

    // Generic angle buckets to encourage distinct takes without hardcoding visuals
    const angleBuckets = [
      "Setting/location vibe (e.g., vantage point, scenery, backdrop).",
      "People/interaction/action happening.",
      "Sensory details (temperature, light, sound, texture).",
      "Time/weather/mood of the moment.",
      "Usage or next move with what's visible."
    ];

    const angleHints = Array.from({ length: count }, (_, i) => angleBuckets[i % angleBuckets.length]);

    const buildMessages = (angleHint: string): Message[] => {
      const angleInstruction = `Angle: ${angleHint} Make this reply distinct from the other suggestions—use different opening words, verbs, and question topics. Avoid boilerplate like "looks amazing" or repeating the same question. Anchor strictly to visible elements; no guessing. Keep it natural and curious.`;
      const userPrompt = `${baseUserPrompt}
- ${angleInstruction}`;

      const messages: Message[] = [
        { role: "system", content: systemPrompt.system },
      ];

      if (imageUrl) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: userPrompt.trim() },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        });
      } else {
        messages.push({
          role: "user",
          content: userPrompt.trim(),
        });
      }

      return messages;
    };

    console.log(`Calling OpenAI API ${count} times in parallel with model gpt-5-mini...`);

    const apiCall = async (angleHint: string) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      try {
        // Note: Some newer models (e.g. gpt-5-*) only support default sampling params.
        // Avoid sending non-default temperature/penalties to prevent 400s.
        const chatModel = "gpt-5-mini";
        const requestBody: Record<string, unknown> = {
          model: chatModel,
          messages: buildMessages(angleHint),
          max_completion_tokens: 150,
          n: 1, // Always request ONE choice
        };
        if (!chatModel.startsWith("gpt-5")) {
          requestBody.temperature = 0.7; // Slightly higher for variety
          requestBody.presence_penalty = 0.6; // Push away from repeats
          requestBody.frequency_penalty = 0.5;
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAIApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error("OpenAI API error:", errorData);
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        let content = data.choices[0].message.content.trim();

        // Aggressive sanitization: If the AI returns a list, take only the first item.
        if (content.match(/^\s*1\./)) {
          // Split by any subsequent numbered list markers (e.g., "2.", "3.")
          const parts = content.split(/\s\d\./);
          // Take the first part and remove the "1." prefix.
          content = parts[0].replace(/^\s*1\.\s*/, '').trim();
        }
        
        return content;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // Create an array of promises with distinct angles
    const promises = angleHints.map((angle) => apiCall(angle));

    // Await all promises to resolve
    const rawStarters = await Promise.all(promises);

    // Deduplicate the starters to ensure uniqueness, as parallel calls might still yield similar results
    const seen = new Set<string>();
    const conversationStarters = rawStarters.filter((starter) => {
      const key = starter.toLowerCase().trim();
      if (seen.has(key)) return false;
      const firstWords = key.split(/\s+/).slice(0, 5).join(" ");
      if ([...seen].some(existing => existing.startsWith(firstWords))) {
        return false;
      }
      seen.add(key);
      return true;
    });

    console.log("Generated conversation starters:", conversationStarters);

    return new Response(
      JSON.stringify({
        conversationStarters,
        promptVersion: systemPrompt.version,
        stylePath: systemPrompt.stylePath,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-story-interruptions function:", error);

    let errorMessage = "An unknown error occurred.";
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        errorMessage =
          "The request to the AI service timed out. Please try again.";
        statusCode = 504; // Gateway Timeout
      } else {
        errorMessage = error.message;
      }
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        conversationStarters: [],
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
