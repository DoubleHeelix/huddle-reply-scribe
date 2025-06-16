
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const allowedOrigins = [
  'http://localhost:8080',
  'https://localhost:8080',
  // Add your mobile device's local IP if needed, e.g., 'http://192.168.1.100:8080'
];

serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('Origin') || '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Function started, checking API key...');
    
    if (!openAIApiKey) {
      console.error('OpenAI API key not found');
      throw new Error('OpenAI API key not configured');
    }

    const { storyText, imageUrl, count = 3 } = await req.json();

    console.log('Generating story interruptions for:', { 
      hasText: !!storyText, 
      hasImage: !!imageUrl, 
      count 
    });

    // Get random prompt variation
    const prompts = [
      {
        system: "You are an observant and thoughtful friend crafting Instagram story replies. Your goal is to start genuine, warm, and curious conversations based strictly on the visible content. Always reference what's actually there—no guessing or speculation. Keep replies authentic, friendly, and simple. Use at most one emoji, only if it fits naturally.",
        version: "A"
      },
      {
        system: "You are a friendly and engaging buddy replying to Instagram stories. Your aim is to spark a fun and lighthearted chat by noticing something specific in the story. Be curious and ask a simple question about what you see. Keep it casual and use a single emoji to add a bit of personality.",
        version: "B"
      }
    ];

    const selectedPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    const userPromptHeader = "A friend posted an Instagram story.";
    const storyContentLine = storyText.trim() 
      ? `Story Content: ${storyText.trim()}`
      : "Story Content: This is an IMAGE. Before replying, list to yourself the main objects, scene, or food you *see*. Your reply must mention or ask about one of these visible elements.";

    const userPrompt = `
${userPromptHeader}

${storyContentLine}

Your Task:
Write a short, warm, and curious reply based strictly on the visible story (or text, if present). The reply should feel human and authentic.

Instructions:
- If image only: Mention or ask about something clearly visible. Don't speculate beyond what's shown. If unclear, use a general but positive line.
- If text: Respond thoughtfully to the text.
- Where possible, include a question at the end to prompt conversation.
- Be authentic and simple. Avoid being overly clever, eccentric, or bubbly.
- Use at most one emoji, only if it fits.
- Do **not** use quotation marks in your draft.
- Do **not** use any preamble—just write the message directly.
- If the image contains overlays, music tags, or device UI, **ignore** them and focus only on the central, main scene or food.

Examples:
Good: "That breakfast looks amazing! Enjoy!"
Good: "Looks like a fun night out! How was the concert?"
Bad: "Cool project! What are you building?" (when nothing suggests a project)
`;

    // Prepare messages for API
    type Message = {
      role: "system" | "user";
      content: string | { type: string; text?: string; image_url?: { url: string } }[];
    };

    const messages: Message[] = [
      { role: "system", content: selectedPrompt.system }
    ];

    // Add user message with image if provided
    if (imageUrl) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userPrompt.trim() },
          { type: "image_url", image_url: { url: imageUrl } }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: userPrompt.trim()
      });
    }

    console.log('Calling OpenAI API with model gpt-4o...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

    let response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages,
          max_tokens: 150,
          n: count,
          temperature: 1.0
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('OpenAI response received, choices:', data.choices?.length);

    const conversationStarters = data.choices?.map((choice: any) => 
      choice.message.content.trim()
    ) || [];

    console.log('Generated conversation starters:', conversationStarters);

    return new Response(JSON.stringify({ 
      conversationStarters,
      promptVersion: selectedPrompt.version 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-story-interruptions function:', error);
    
    let errorMessage = 'An unknown error occurred.';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'The request to the AI service timed out. Please try again.';
        statusCode = 504; // Gateway Timeout
      } else {
        errorMessage = error.message;
      }
    }

    return new Response(JSON.stringify({
      error: errorMessage,
      conversationStarters: []
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
