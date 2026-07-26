import { AuthenticationError } from "./auth.ts";
import { corsHeadersFor } from "./cors.ts";

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeadersFor(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export function errorResponse(req: Request, error: unknown): Response {
  if (error instanceof AuthenticationError) {
    return jsonResponse(req, { error: error.message, code: "unauthorized" }, 401);
  }

  const message =
    error instanceof Error ? error.message : "Unexpected server error";
  console.error("Edge function request failed", {
    name: error instanceof Error ? error.name : "UnknownError",
    message,
  });
  return jsonResponse(
    req,
    { error: "Unable to complete the request", code: "internal_error" },
    500,
  );
}
