
import { cleanReply, truncateText } from './textProcessing';

// Constants from the original Python code
const MAX_HUDDLES_CONTEXT = 3;
const MAX_DOCS_CONTEXT = 2;
const MAX_CHUNK_LEN_CONTEXT = 400;

const SYSTEM_PROMPT = `You are a warm, emotionally intelligent, and concise assistant trained for network marketing conversations. Your replies should sound human, personal, and naturally flowing—never robotic, scripted, or overly formal. Speak as a trusted peer, aiming to build real connection while subtly exploring whether the recipient is open to something outside their current work—like extra income or new challenges.

KEY GUIDELINES:
1. CONTEXT-FIRST: Carefully read both the screenshot and user's draft. Your message should naturally continue the conversation, not just rephrase the draft—refine it with clarity and direction.
2. KEEP CONVO GOING: If the draft lacks a question or forward motion, add a natural, open-ended question based on the flow or recipient's situation to invite response.
3. TONE MATCHING: Reflect the recipient's tone—casual, curious, upbeat, etc.—while staying warm, curious, and non-salesy.
4. SOFT OPPORTUNITY FRAMING: The goal is to gently explore if they're open to new ideas or income streams. Don't pitch. Focus on curiosity, values, or current priorities.
5. AVOID CLICHÉS: Never use terms like 'financial freedom,' 'passive income,' 'amazing opportunity,' or 'mentorship.' Use grounded, relatable language.
6. FOLLOW HUDDLE PRINCIPLES: Clarity, Connection, Brevity, Flow, Empathy.
7. NO PREFACES: Never start with 'Draft:' or 'Here's a suggestion.' Just write the reply as if you're sending it directly.`;

interface SuggestionOptions {
  screenshotText: string;
  userDraft: string;
  principles?: string;
  modelName?: string;
  isRegeneration?: boolean;
  apiKey: string;
}

interface ToneAdjustmentOptions {
  originalReply: string;
  selectedTone: string;
  modelName?: string;
  apiKey: string;
}

export const generateSuggestedReply = async ({
  screenshotText,
  userDraft,
  principles = '',
  modelName = 'gpt-4.1-2025-04-14',
  isRegeneration = false,
  apiKey
}: SuggestionOptions): Promise<string> => {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const truncatedScreenshot = truncateText(screenshotText, 1200);
  const truncatedDraft = truncateText(userDraft, 600);

  let userPromptContent = `KEY PRINCIPLES FOR YOUR REPLY (Strictly Follow These):
${principles}

CURRENT CONVERSATION (FROM SCREENSHOT):
${truncatedScreenshot}

USER'S DRAFT IDEA (Use for inspiration on topic/intent. Improve it based on principles and context. Do NOT just rephrase the draft if it's weak or misses the mark.):
${truncatedDraft}

YOUR TASK:
Craft the best, most natural, and human reply for this scenario. Adhere strictly to the system prompt and the key principles. Be direct—do not reference that this is a draft or a suggestion. Write the message exactly as if you were sending it to the person in the conversation.`;

  let temperature = 0.65;

  if (isRegeneration) {
    userPromptContent += `

IMPORTANT REGENERATION INSTRUCTION:
You have provided a suggestion before for this scenario. Now, please provide a *significantly different* angle or approach. Explore alternative ways to phrase the core message or focus on different aspects of the user's draft or the conversation context. Be creative, offer a fresh perspective, and ensure this new suggestion is distinct from any previous ones for this exact request.`;
    temperature = 0.75;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPromptContent }
        ],
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
    
    return cleanReply(rawReply);
  } catch (error) {
    console.error('Error generating suggestion:', error);
    if (error instanceof Error) {
      throw new Error(`Error generating suggestion: ${error.message}`);
    }
    throw new Error('Unexpected error generating suggestion');
  }
};

export const generateAdjustedTone = async ({
  originalReply,
  selectedTone,
  modelName = 'gpt-4.1-2025-04-14',
  apiKey
}: ToneAdjustmentOptions): Promise<string> => {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  if (!selectedTone || selectedTone.toLowerCase() === 'none') {
    return originalReply;
  }

  const truncatedOriginalReply = truncateText(originalReply, 1000);

  const toneSystemPrompt = `You are an expert at rephrasing text to match a specific conversational tone with emotional intelligence. Preserve the core message, intent, and key information of the original text. Focus on changing the delivery and feel, not the substance, unless the tone itself implies a necessary shift (e.g. 'more direct' might shorten it). Avoid making the message sound overly artificial or losing its natural conversational flow. Do NOT add any preamble like 'Okay, here's the version in a ... tone'. Just provide the rephrased message directly.`;

  const toneUserPrompt = `Please rewrite the following message in a more ${selectedTone.toLowerCase()} tone. Ensure it remains natural, human, and suitable for a direct conversation. The message should still be concise and clear, reflecting the requested tone.

Original Message to rephrase:
"""
${truncatedOriginalReply}
"""`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: toneSystemPrompt },
          { role: 'user', content: toneUserPrompt }
        ],
        temperature: 0.7,
        max_tokens: 400
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const rawAdjustedReply = data.choices?.[0]?.message?.content || '';
    
    return cleanReply(rawAdjustedReply);
  } catch (error) {
    console.error('Error adjusting tone:', error);
    return originalReply; // Return original on error
  }
};
