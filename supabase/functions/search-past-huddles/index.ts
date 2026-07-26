import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuthenticatedUser } from "../shared/auth.ts";
import { handleCorsPreflight } from "../shared/cors.ts";
import { errorResponse, jsonResponse } from "../shared/http.ts";
import { fetchWithTimeout } from "../shared/provider.ts";

const OPENAI_TIMEOUT_MS = 30_000;
const MAX_QUERY_CHARACTERS = 5_000;

function clip(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 1)}…`;
}

serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    const { user, serviceClient } = await requireAuthenticatedUser(req);
    const body = await req.json();
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    if (!query || query.length > MAX_QUERY_CHARACTERS) {
      return jsonResponse(req, { error: "Invalid search query" }, 400);
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) throw new Error("OpenAI configuration is missing");

    const embeddingResponse = await fetchWithTimeout(
      "https://api.openai.com/v1/embeddings",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: query,
          model: "text-embedding-3-small",
        }),
      },
      OPENAI_TIMEOUT_MS,
    );

    if (!embeddingResponse.ok) {
      console.error("History embedding request failed", {
        status: embeddingResponse.status,
      });
      throw new Error("History embedding request failed");
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData?.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      throw new Error("Embedding provider returned an invalid response");
    }

    const { data, error } = await serviceClient.rpc("match_huddle_plays", {
      query_embedding: embedding,
      match_threshold: 0.75,
      match_count: 5,
      p_user_id: user.id,
    });

    if (error) {
      console.error("History search failed", { code: error.code });
      throw new Error("Unable to search Huddle history");
    }

    const safeResults = (data || []).map((huddle: Record<string, unknown>) => ({
      ...huddle,
      screenshot_text: clip(huddle.screenshot_text, 4_000),
      user_draft: clip(huddle.user_draft, 2_000),
      generated_reply: clip(huddle.generated_reply, 2_500),
      final_reply: clip(huddle.final_reply, 2_500),
    }));
    return jsonResponse(req, safeResults);
  } catch (error) {
    return errorResponse(req, error);
  }
});
