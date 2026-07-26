import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  hasAdminRole,
  requireAuthenticatedUser,
} from "../shared/auth.ts";
import { handleCorsPreflight } from "../shared/cors.ts";
import {
  errorResponse,
  jsonResponse,
} from "../shared/http.ts";
import { fetchWithTimeout } from "../shared/provider.ts";

const OPENAI_TIMEOUT_MS = 30_000;
const MAX_QUERY_CHARACTERS = 10_000;
const MAX_DOCUMENT_CHUNK_CHARACTERS = 24_000;

type EmbeddingRequest = {
  query_text?: unknown;
  document_name?: unknown;
  extracted_text?: unknown;
  chunk_index?: unknown;
  total_chunks?: unknown;
  metadata?: unknown;
};

function requireNonEmptyString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`${field} exceeds the supported size`);
  }
  return trimmed;
}

function optionalInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : fallback;
}

async function createEmbedding(input: string, apiKey: string): Promise<number[]> {
  const response = await fetchWithTimeout(
    "https://api.openai.com/v1/embeddings",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input,
        model: "text-embedding-3-small",
      }),
    },
    OPENAI_TIMEOUT_MS,
  );

  if (!response.ok) {
    console.error("Embedding provider request failed", {
      status: response.status,
    });
    throw new Error("Embedding provider request failed");
  }

  const data = await response.json();
  const embedding = data?.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error("Embedding provider returned an invalid response");
  }
  return embedding;
}

serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) throw new Error("OpenAI configuration is missing");

    const { user, serviceClient } = await requireAuthenticatedUser(req);
    const body = (await req.json()) as EmbeddingRequest;

    if (body.query_text !== undefined) {
      const queryText = requireNonEmptyString(
        body.query_text,
        "query_text",
        MAX_QUERY_CHARACTERS,
      );
      const embedding = await createEmbedding(queryText, openaiApiKey);
      return jsonResponse(req, { embedding });
    }

    if (!hasAdminRole(user)) {
      return jsonResponse(
        req,
        { error: "Administrator access required", code: "forbidden" },
        403,
      );
    }

    const documentName = requireNonEmptyString(
      body.document_name,
      "document_name",
      500,
    );
    const extractedText = requireNonEmptyString(
      body.extracted_text,
      "extracted_text",
      MAX_DOCUMENT_CHUNK_CHARACTERS,
    );
    const embedding = await createEmbedding(extractedText, openaiApiKey);
    const metadata =
      body.metadata &&
      typeof body.metadata === "object" &&
      !Array.isArray(body.metadata)
        ? body.metadata as Record<string, unknown>
        : {};

    const { error } = await serviceClient.from("document_knowledge").insert({
      user_id: user.id,
      document_name: documentName,
      content_chunk: extractedText,
      embedding,
      chunk_index: optionalInteger(body.chunk_index, 0),
      metadata: {
        ...metadata,
        total_chunks: optionalInteger(body.total_chunks, 1),
        chunk_size: extractedText.length,
        created_at: new Date().toISOString(),
      },
    });

    if (error) {
      console.error("Document embedding insert failed", { code: error.code });
      throw new Error("Unable to store document embedding");
    }

    return jsonResponse(req, {
      success: true,
      chunks_processed: 1,
      document_name: documentName,
      text_length: extractedText.length,
    });
  } catch (error) {
    return errorResponse(req, error);
  }
});
