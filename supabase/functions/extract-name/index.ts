import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuthenticatedUser } from "../shared/auth.ts";
import { handleCorsPreflight } from "../shared/cors.ts";
import { errorResponse, jsonResponse } from "../shared/http.ts";
import { fetchWithTimeout } from "../shared/provider.ts";

const OPENAI_TIMEOUT_MS = 20_000;
const MAX_LINES = 15;
const MAX_CHARS = 1_200;
const SYSTEM_PROMPT = `Extract one likely participant name or handle from a short chat transcript.
Return only the name or handle. Return UNKNOWN when uncertain.
Prefer the other participant. Ignore timestamps, status labels, and chat UI labels.`;

function trimTranscript(value: unknown): string {
  if (typeof value !== "string") return "";
  const withoutControls = Array.from(value)
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("");
  return withoutControls
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_LINES)
    .join("\n")
    .slice(0, MAX_CHARS);
}

function isLikelyName(value: string): boolean {
  const cleaned = value.trim();
  if (cleaned.length < 3 || cleaned.length > 60) return false;
  return (
    /^([A-Z][a-zA-Z'’.-]+(?:\s+[A-Z][a-zA-Z'’.-]+){0,3})$/.test(cleaned) ||
    /^@?[A-Za-z][\w.]{3,30}$/.test(cleaned)
  );
}

serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    await requireAuthenticatedUser(req);
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OpenAI configuration is missing");

    const body = await req.json().catch(() => ({}));
    const transcript = trimTranscript(body?.text);
    if (!transcript) {
      return jsonResponse(req, { candidate: "UNKNOWN", confidence: 0 });
    }

    const response = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Transcript snippet:\n"""${transcript}"""`,
            },
          ],
          temperature: 0,
        }),
      },
      OPENAI_TIMEOUT_MS,
    );
    if (!response.ok) {
      console.error("Name extraction provider request failed", {
        status: response.status,
      });
      throw new Error("Name extraction provider request failed");
    }

    const data = await response.json();
    const raw = String(data?.choices?.[0]?.message?.content || "").trim();
    const candidate = isLikelyName(raw) ? raw : "UNKNOWN";
    return jsonResponse(req, {
      candidate,
      confidence: candidate === "UNKNOWN" ? 0.15 : 0.72,
    });
  } catch (error) {
    return errorResponse(req, error);
  }
});
