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
      .select("style_description")
      .eq("user_id", userId)
      .single();

    if (styleError) {
      console.error("Error fetching user style profile:", styleError);
      // Continue without style profile for now, or handle error as needed
    }

    const styleInstruction = styleProfile?.style_description
      ? `Your primary instruction is to adopt the following writing style: ${styleProfile.style_description}. All other guidelines are secondary to this style.`
      : "You are an observant and thoughtful friend crafting Instagram story replies. Your goal is to start genuine, warm, and curious conversations based strictly on the visible content. Always reference what's actually there—no guessing or speculation. Keep replies authentic, friendly, and simple. Use at most one emoji, only if it fits naturally.";

    const contextFromStyleProfile = styleProfile?.style_description
      ? styleProfile.style_description
      : "Default: Be observant, thoughtful, and curious. Keep it simple and authentic.";

    const systemPrompt = {
      system: styleInstruction,
      version: styleProfile ? "Custom" : "Default",
    };

    const userPromptHeader = "A friend posted an Instagram story.";
    const storyContentLine =
      storyText && storyText.trim()
        ? `Story Content: ${storyText.trim()}`
        : "Story Content: This is an IMAGE. Before replying, list to yourself the main objects, scene, or food you *see*. Your reply must mention or ask about one of these visible elements.";

    const userPrompt = `A friend posted this on their story:
    - Story Content: ${storyContentLine}
    
    Your Task: Write ${count} unique, short, warm replies that sound like a real and curious friend.
    **Style Guide:**
    - The user's tone and personality should come through in every reply.
    - Write in the user's natural style:
      ${contextFromStyleProfile}
    
    Each reply must:
    - Be based strictly on visible details (text or image). Never guess what’s not shown.
    - If the image is unclear, keep it positive and simple.
    - End with a natural, open-ended question that invites conversation.
    - Feel human and authentic—avoid being overly dramatic, cutesy, or overly witty.
    - Use straightforward terms for pets (e.g., "your dog" not "fur baby").
    - Use at most one emoji—only if it adds natural warmth.
    - Ignore overlays, UI elements, or music tags.
    - Get straight to the message (no quotes, no intros).`;
    // Prepare messages for API
    type Message = {
      role: "system" | "user";
      content:
        | string
        | { type: string; text?: string; image_url?: { url: string } }[];
    };

    const messages: Message[] = [
      { role: "system", content: systemPrompt.system },
    ];

    // Add user message with image if provided
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

    console.log("Calling OpenAI API with model gpt-4o...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25-second timeout

    let response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAIApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages,
          max_tokens: 150,
          n: count,
          temperature: 0.6,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI API error:", errorData);
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log("OpenAI response received, choices:", data.choices?.length);

    const rawStarters =
      data.choices?.map((choice: any) => choice.message.content.trim()) || [];

    // Deduplicate the starters to ensure uniqueness
    const uniqueStarters = [...new Set(rawStarters)];

    const conversationStarters = uniqueStarters;

    console.log("Generated conversation starters:", conversationStarters);

    return new Response(
      JSON.stringify({
        conversationStarters,
        promptVersion: systemPrompt.version,
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
