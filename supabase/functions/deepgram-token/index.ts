import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuthenticatedUser } from "../shared/auth.ts";
import { handleCorsPreflight } from "../shared/cors.ts";
import { errorResponse, jsonResponse } from "../shared/http.ts";
import { fetchWithTimeout } from "../shared/provider.ts";

serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    await requireAuthenticatedUser(req);
    const apiKey = Deno.env.get("DEEPGRAM_API_KEY");
    const projectId = Deno.env.get("DEEPGRAM_PROJECT_ID");
    if (!apiKey || !projectId) {
      throw new Error("Transcription configuration is missing");
    }

    const response = await fetchWithTimeout(
      `https://api.deepgram.com/v1/projects/${encodeURIComponent(projectId)}/keys`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comment: "Temporary key for Huddle Play",
          scopes: ["usage:write"],
          time_to_live_in_seconds: 600,
        }),
      },
      20_000,
    );
    if (!response.ok) {
      console.error("Transcription token provider request failed", {
        status: response.status,
      });
      throw new Error("Unable to issue a transcription token");
    }

    const data = await response.json();
    if (typeof data?.key !== "string") {
      throw new Error("Transcription provider returned an invalid response");
    }
    return jsonResponse(req, { key: data.key });
  } catch (error) {
    return errorResponse(req, error);
  }
});
