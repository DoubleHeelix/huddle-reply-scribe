const defaultAllowedOrigins = [
  "http://localhost:8080",
  "https://localhost:8080",
  "http://localhost:8081",
  "https://localhost:8081",
  "https://huddle-reply-scribe-production.up.railway.app",
];

function allowedOrigins(): Set<string> {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((origin: string) => origin.trim())
    .filter(Boolean);

  return new Set(configured.length ? configured : defaultAllowedOrigins);
}

export function corsHeadersFor(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, idempotency-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  const origin = req.headers.get("Origin");

  if (origin && allowedOrigins().has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;

  const origin = req.headers.get("Origin");
  const originAllowed = !origin || allowedOrigins().has(origin);
  return new Response(null, {
    status: originAllowed ? 204 : 403,
    headers: corsHeadersFor(req),
  });
}
