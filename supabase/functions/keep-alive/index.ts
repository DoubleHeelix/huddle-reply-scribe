import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCorsPreflight } from "../shared/cors.ts";
import { jsonResponse } from "../shared/http.ts";
import { fetchWithTimeout } from "../shared/provider.ts";

serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const keepAliveSecret =
    Deno.env.get("KEEP_ALIVE_SECRET") || serviceRoleKey;
  const suppliedSecret = req.headers
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!keepAliveSecret || suppliedSecret !== keepAliveSecret) {
    return jsonResponse(
      req,
      { error: "Authentication required", code: "unauthorized" },
      401,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(req, { ok: false }, 500);
  }

  try {
    const response = await fetchWithTimeout(
      `${supabaseUrl}/functions/v1/enhanced-ai-suggestions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "health" }),
      },
      10_000,
    );
    return jsonResponse(
      req,
      { ok: response.ok, status: response.status },
      response.ok ? 200 : 502,
    );
  } catch {
    return jsonResponse(req, { ok: false }, 502);
  }
});
