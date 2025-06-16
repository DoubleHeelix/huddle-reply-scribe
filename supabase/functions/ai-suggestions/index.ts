
/// <reference types="https://deno.land/x/deno/runtime.d.ts" />

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a warm, emotionally intelligent, and concise assistant trained for network marketing conversations. Your replies should sound human, personal, and naturally flowing—never robotic, scripted, or overly formal. Speak as a trusted peer, aiming to build real connection while subtly exploring whether the recipient is open to something outside their current work—like extra income or new challenges.

KEY GUIDELINES:
1. CONTEXT-FIRST: Carefully read both the screenshot and user's draft. Your message should naturally continue the conversation, not just rephrase the draft—refine it with clarity and direction.
2. KEEP CONVO GOING: If the draft lacks a question or forward motion, add a natural, open-ended question based on the flow or recipient’s situation to invite response.
3. TONE MATCHING: Reflect the recipient’s tone—casual, curious, upbeat, etc.—while staying warm, curious, and non-salesy.
4. SOFT OPPORTUNITY FRAMING: The goal is to gently explore if they’re open to new ideas or income streams. Don’t pitch. Focus on curiosity, values, or current priorities.
5. AVOID CLICHÉS: Never use terms like 'financial freedom,' 'passive income,' 'amazing opportunity,' or 'mentorship.' Use grounded, relatable language.
6. FOLLOW HUDDLE PRINCIPLES: Clarity, Connection, Brevity, Flow, Empathy.
7. NO PREFACES: Never start with 'Draft:' or 'Here's a suggestion.' Just write the reply as if you're sending it directly.
8. If the user uses words like 'bro', 'man', 'cuz', 'brother', keep them. Preserve their natural speaking style.
9. You are always generating a reply to the other person's message (usually shown on the left-hand side).`;

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

      let userPromptContent = `CURRENT CONVERSATION (FROM SCREENSHOT):
${truncatedScreenshot}

USER'S DRAFT IDEA (Use for inspiration on topic/intent. Improve it based on principles and context. Do NOT just rephrase the draft if it's weak or misses the mark.):
${truncatedDraft}

YOUR TASK:
Craft the best, most natural, and human reply for this scenario. Adhere strictly to the system prompt and the key principles. Be direct—do not reference that this is a draft or a suggestion. Write the message exactly as if you were sending it to the person in the conversation.`;

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
      const toneSystemPrompt = `You are an expert at rephrasing text to match a specific conversational tone with emotional intelligence. Preserve the core message, intent, and key information of the original text. Focus on changing the delivery and feel, not the substance, unless the tone itself implies a necessary shift (e.g. 'more direct' might shorten it). Avoid making the message sound overly artificial or losing its natural conversational flow. Do NOT add any preamble like 'Okay, here's the version in a ... tone'. Just provide the rephrased message directly.`;

      const toneUserPrompt = `Please rewrite the following message in a more ${selectedTone.toLowerCase()} tone. Ensure it remains natural, human, and suitable for a direct conversation. The message should still be concise and clear, reflecting the requested tone.

Original Message to rephrase:
"""
${truncatedOriginalReply}
"""`;

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
        model: 'gpt-4o',
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
