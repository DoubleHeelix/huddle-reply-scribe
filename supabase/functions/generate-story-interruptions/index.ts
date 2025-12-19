import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

const allowedOrigins = [
  "http://localhost:8080",
  "https://localhost:8080",
  "http://localhost:8081",
  "https://localhost:8081",
  "https://huddle-reply-scribe-production.up.railway.app",
  // Add your mobile device's local IP if needed, e.g., 'http://192.168.1.100:8080'
];

const OPENAI_IMAGE_FETCH_TIMEOUT_MS = 15_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const BASE64_CHUNK_SIZE = 0x8000; // avoid stack overflows when encoding

function extractMessageText(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const maybeText =
            (part as { text?: string }).text ??
            (part as { content?: string }).content;
          if (typeof maybeText === "string") return maybeText;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return "";
}

async function fetchImageAsDataUrl(imageUrl: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new Error("Invalid imageUrl (must be a valid URL).");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid imageUrl (must be http/https).");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_IMAGE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(imageUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to download image (${response.status} ${response.statusText}).`);
    }

    const contentTypeRaw = response.headers.get("content-type") || "";
    const headerContentType = contentTypeRaw.split(";")[0].trim().toLowerCase();
    const urlPath = parsed.pathname.toLowerCase();
    const inferredContentType = urlPath.endsWith(".png")
      ? "image/png"
      : urlPath.endsWith(".jpg") || urlPath.endsWith(".jpeg")
        ? "image/jpeg"
        : urlPath.endsWith(".webp")
          ? "image/webp"
          : urlPath.endsWith(".gif")
            ? "image/gif"
            : "";
    const contentType = headerContentType.startsWith("image/")
      ? headerContentType
      : inferredContentType;
    if (!contentType) {
      throw new Error(`Unsupported content-type for image: ${contentTypeRaw || "unknown"}.`);
    }

    const lengthHeader = response.headers.get("content-length");
    const contentLength = lengthHeader ? Number(lengthHeader) : NaN;
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      throw new Error(`Image too large (${contentLength} bytes).`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new Error(`Image too large (${bytes.byteLength} bytes).`);
    }

    let binary = "";
    // Build the binary string in chunks so we don't blow the argument limit for fromCharCode.
    for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
      binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK_SIZE));
    }

    return `data:${contentType};base64,${btoa(binary)}`;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Timed out while downloading the story image.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

type StyleProfileRow = {
  formality: string | null;
  sentiment: string | null;
  common_topics: string[] | null;
  avg_sentence_length: number | null;
  common_phrases: { bigrams?: string[]; trigrams?: string[] } | null;
  style_fingerprint: Record<string, unknown> | null;
};

function buildStyleDescription(profile?: StyleProfileRow | null): string | null {
  if (!profile) return null;

  const parts: string[] = [];
  if (profile.formality) parts.push(`Formality: ${profile.formality}`);
  if (profile.sentiment) parts.push(`Sentiment: ${profile.sentiment}`);
  if (profile.avg_sentence_length) parts.push(`Avg sentence length: ${profile.avg_sentence_length} words`);
  if (profile.common_topics?.length) parts.push(`Common topics: ${profile.common_topics.slice(0, 5).join(", ")}`);

  const bigrams = profile.common_phrases?.bigrams?.slice(0, 6) || [];
  const trigrams = profile.common_phrases?.trigrams?.slice(0, 4) || [];
  const phraseHints = [...bigrams, ...trigrams].filter(Boolean);
  if (phraseHints.length) parts.push(`Common phrasing: ${phraseHints.join(", ")}`);

  return parts.length ? parts.join(". ") + "." : null;
}

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
      .select(
        "formality, sentiment, common_topics, avg_sentence_length, common_phrases, style_fingerprint"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (styleError) {
      console.error("Error fetching user style profile:", styleError);
      // Continue without style profile for now, or handle error as needed
    }

    const styleDescription = buildStyleDescription(styleProfile as StyleProfileRow | null);

    const fingerprintSummary = formatStyleFingerprintSummary(
      (styleProfile as StyleProfileRow | null)?.style_fingerprint || undefined
    );

    const styleInstruction = styleDescription
      ? `Your primary instruction is to adopt the following writing style: ${styleDescription} Mirror the user's phrasing and cadence; if this conflicts with other rules, prefer this style.${
          fingerprintSummary ? ` Cadence notes: ${fingerprintSummary}` : ""
        }`
      : "You are an observant and thoughtful friend crafting Instagram story replies. Your goal is to start genuine, warm, and curious conversations based strictly on the visible content. Always reference what's actually there—no guessing or speculation. Keep replies authentic, friendly, and simple. Use at most one emoji, only if it fits naturally.";

    const contextFromStyleProfile = styleDescription
      ? `${styleDescription}${fingerprintSummary ? `\n${fingerprintSummary}` : ""}`
      : "Default: Be observant, thoughtful, and curious. Keep it simple and authentic.";

    const systemPrompt = {
      system: styleInstruction,
      version: styleDescription ? "Custom" : "Default",
      stylePath: styleDescription ? "custom" : "default",
    };

    let openAIImageUrl: string | null = null;
    if (imageUrl) {
      try {
        openAIImageUrl = await fetchImageAsDataUrl(imageUrl);
      } catch (error) {
        console.error("Failed to fetch story image for OpenAI:", error);
        if (!storyText || !storyText.trim()) {
          throw error instanceof Error
            ? error
            : new Error("Failed to download the story image.");
        }
      }
    }

    const userPromptHeader = "A friend posted an Instagram story.";
    const storyContentLine =
      storyText && storyText.trim()
        ? `Story Content: ${storyText.trim()}`
        : "Story Content: This is an IMAGE. First, silently list 3-5 visible objects or activities, pick one, then write the reply anchored to that visible element.";

    const baseUserPrompt = `${userPromptHeader}
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
- Each reply must be plain text (no lists, numbering, quotes, or markdown).`;
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

    const buildMessages = (): Message[] => {
      const angleSection = angleHints
        .map((hint, i) => `${i + 1}) ${hint}`)
        .join("\n");

      const multiOutputInstruction = `Generate exactly ${count} distinct replies. Each reply should use a different angle from this list:\n${angleSection}\n\nReturn ONLY valid JSON: an array of ${count} strings. No extra keys, no markdown, no commentary.`;

      const userPrompt = `${baseUserPrompt}\n\n${multiOutputInstruction}`.trim();

      const messages: Message[] = [{ role: "system", content: systemPrompt.system }];

      if (openAIImageUrl) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: openAIImageUrl } },
          ],
        });
      } else {
        messages.push({ role: "user", content: userPrompt });
      }

      return messages;
    };

    const chatModel = "gpt-4o-mini";
    console.log(`Calling OpenAI API once with model ${chatModel} (count=${count})...`);

    const apiCall = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      try {
        // Note: Some newer models (e.g. gpt-5-*) only support default sampling params.
        // Avoid sending non-default temperature/penalties to prevent 400s.
        const requestBody: Record<string, unknown> = {
          model: chatModel,
          messages: buildMessages(),
          max_completion_tokens: 350,
          n: 1,
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
          throw new Error(
            `OpenAI API error: ${response.status} ${response.statusText}${errorData ? ` - ${errorData}` : ""}`
          );
        }

        const data = await response.json();
        const content = extractMessageText(data?.choices?.[0]?.message?.content);
        console.log("OpenAI content raw (truncated):", content.slice(0, 400));

        // Expect JSON array. If the model includes extra text, try to extract the first JSON array.
        const start = content.indexOf("[");
        const end = content.lastIndexOf("]");
        const jsonSlice = start !== -1 && end !== -1 && end > start ? content.slice(start, end + 1) : content;

        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonSlice);
        } catch {
          parsed = null;
        }

        if (Array.isArray(parsed)) {
          const parsedClean = parsed.map((x) => String(x)).filter(Boolean);
          if (parsedClean.length === 0) {
            console.warn("Parsed JSON array was empty; falling back to line parsing.");
          } else {
            return parsedClean;
          }
        }

        // Fallback: split lines and strip numbering/bullets.
        return content
          .split("\n")
          .map((line) => line.replace(/^\s*[-*]\s+/, "").replace(/^\s*\d+\.\s+/, "").trim())
          .filter(Boolean);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const rawStarters = await apiCall();

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
    }).slice(0, count);

    let finalStarters = conversationStarters;

    if (finalStarters.length === 0) {
      console.warn("No conversation starters parsed; using safe fallbacks.");
      const fallbackTopic = (storyText || "").trim();
      const fallbackAnchor =
        fallbackTopic &&
        !/no text detected/i.test(fallbackTopic) &&
        !/text extracted/i.test(fallbackTopic)
          ? fallbackTopic.slice(0, 80)
          : "";
      finalStarters = [
        `Looks great—what was happening here?`,
        `This caught my eye. Where is this?`,
        `Love the vibe—what's the story behind it?`,
      ];
      if (fallbackAnchor) {
        finalStarters[0] = `This about "${fallbackAnchor}" is cool—what's the backstory?`;
      }
    }

    console.log("Generated conversation starters:", finalStarters);

    return new Response(
      JSON.stringify({
        conversationStarters: finalStarters,
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
      } else if (error.message.startsWith("Invalid imageUrl")) {
        errorMessage = error.message;
        statusCode = 400; // Bad Request
      } else if (error.message.includes("Timed out while downloading the story image")) {
        errorMessage = error.message;
        statusCode = 504; // Gateway Timeout
      } else if (
        error.message.startsWith("Failed to download image") ||
        error.message.startsWith("Unsupported content-type for image") ||
        error.message.startsWith("Image too large")
      ) {
        errorMessage = error.message;
        statusCode = 502; // Bad Gateway (upstream image fetch)
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
