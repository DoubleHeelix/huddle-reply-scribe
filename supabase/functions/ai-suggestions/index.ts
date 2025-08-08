
/// <reference types="https://deno.land/x/deno/runtime.d.ts" />

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a world-class writing partner for network marketers. Your task is to refine a user's draft message into a polished, effective, and authentic reply.

**Core Directives:**
1. **Refine the Draft:** Improve clarity, tone, and flow—don't just rephrase. Keep the user's personality (words like 'bro', 'man', etc.) intact.
2. **Context-Aware:** Read both the user's message and the recipient’s prior message. Continue the conversation naturally.
3. **Invite Response:** If the draft lacks momentum, add a light, open-ended question to keep things going.
4. **Explore Gently:** Subtly sense whether the person might be open to new opportunities (e.g., side income)—never pitch or oversell.
5. **Tone Match:** Mirror the recipient’s tone while staying warm, casual, and grounded.

**Output Rules:**
- Respond with ONLY the refined message.
- No prefaces, no quotes, no commentary.`;

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const cleanReply = (reply: string): string => {
  return reply
    .replace(/^(Here's a|Here is a|Draft:|Suggestion:|Reply:)\s*/i, '')
    .replace(/^\*\*(.*?)\*\*\s*/, '$1')
    .trim();
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      action, 
      screenshotText, 
      userDraft, 
      isRegeneration,
      originalReply,
      selectedTone 
    } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    let messages;
    let temperature = 0.65;

    if (action === 'generateReply') {
      const truncatedScreenshot = truncateText(screenshotText, 1200);
      const truncatedDraft = truncateText(userDraft, 600);

      let userPromptContent = `**Conversation Context:**
${truncatedScreenshot}

**User's Draft:**
"${truncatedDraft}"

**Your Task:**
Refine the user's draft into a polished, natural, and effective reply. Follow all system prompt directives.`;

      if (isRegeneration) {
        userPromptContent += `

IMPORTANT REGENERATION INSTRUCTION:
You have provided a suggestion before for this scenario. Now, please provide a *significantly different* angle or approach. Explore alternative ways to phrase the core message or focus on different aspects of the user's draft or the conversation context. Be creative, offer a fresh perspective, and ensure this new suggestion is distinct from any previous ones for this exact request.`;
        temperature = 0.75;
      }

      messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPromptContent }
      ];
    } else if (action === 'adjustTone') {
      if (!selectedTone || selectedTone.toLowerCase() === 'none') {
        return new Response(JSON.stringify({ reply: originalReply }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const truncatedOriginalReply = truncateText(originalReply, 1000);
      const toneSystemPrompt = `You are an expert at subtly adjusting the tone of a message while preserving its core meaning and the author's authentic voice. Your goal is to make nuanced shifts, not to rewrite the message entirely.

**Instructions:**
1.  **Preserve Core Message:** The fundamental meaning and key information must remain unchanged.
2.  **Maintain Authentic Voice:** The message should still sound like the original author wrote it.
3.  **Subtle Adjustment:** Focus on word choice, phrasing, and sentence structure to gently shift the tone.
4.  **No Preamble:** Respond with only the adjusted message.`;

      const toneUserPrompt = `Adjust the tone of this message to be more **${selectedTone.toLowerCase()}**.

**Original Message:**
"${truncatedOriginalReply}"`;

      messages = [
        { role: 'system', content: toneSystemPrompt },
        { role: 'user', content: toneUserPrompt }
      ];
      temperature = 0.7;
    } else {
      throw new Error('Invalid action specified');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5',
        messages,
        temperature,
        max_tokens: 400
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const rawReply = data.choices?.[0]?.message?.content || '';
    const reply = cleanReply(rawReply);

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-suggestions function:', error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
