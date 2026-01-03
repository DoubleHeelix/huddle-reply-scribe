/// <reference types="https://deno.land/x/deno/runtime.d.ts" />

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You extract one likely participant name or handle from a short chat transcript snippet.

Rules:
- Return only the name/handle, no extra text.
- If you are not confident, return "UNKNOWN".
- Prefer the other participant (not "You", "Me", "Today", "Yesterday", etc.).
- If you see both a full name and a handle, choose the handle if it looks clear (@ryan.couronne), otherwise the name.
- Ignore timestamps, status labels (Active, Online, Typing), and chat UI labels.`;

const MAX_LINES = 15;
const MAX_CHARS = 1200;

const sanitizeText = (text: unknown): string => {
  if (!text || typeof text !== "string") return "";
  return text.replace(/[\u0000-\u001F]+/g, " ").trim();
};

const trimText = (text: string): string => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const limited = lines.slice(0, MAX_LINES).join("\n");
  return limited.length > MAX_CHARS
    ? limited.slice(0, MAX_CHARS) + "..."
    : limited;
};

const isLikelyName = (value: string): boolean => {
  if (!value) return false;
  const cleaned = value.trim();
  if (cleaned.length < 3 || cleaned.length > 60) return false;
  const nameLike = /^([A-Z][a-zA-Z'’.-]+(?:\s+[A-Z][a-zA-Z'’.-]+){0,3})$/.test(
    cleaned,
  );
  const handleLike = /^@?[A-Za-z][\w.]{3,30}$/.test(cleaned);
  return nameLike || handleLike;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const { text } = await req.json().catch(() => ({}));
    const sanitized = sanitizeText(text);

    if (!sanitized) {
      return new Response(
        JSON.stringify({ candidate: "UNKNOWN", confidence: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const trimmed = trimText(sanitized);

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Transcript snippet:\n"""${trimmed}"""\n\nReturn the participant name or handle, or "UNKNOWN".`,
      },
    ];

    const body = {
      model: "gpt-4o-mini",
      messages,
      max_tokens: 32,
      temperature: 0,
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API Error: ${response.status} - ${
          errorData.error?.message || "Unknown error"
        }`,
      );
    }

    const data = await response.json();
    const raw = (data.choices?.[0]?.message?.content || "").trim();
    const candidate = isLikelyName(raw) ? raw : "UNKNOWN";
    const confidence = candidate === "UNKNOWN" ? 0.15 : 0.72;

    return new Response(
      JSON.stringify({ candidate, confidence }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in extract-name function:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
