import supabaseJs from "https://esm.sh/@supabase/supabase-js@2.50.0/dist/umd/supabase.js?target=deno&deno-std=0.168.0";

const { createClient } = supabaseJs;

export class AuthenticationError extends Error {
  status = 401;

  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export function getBearerToken(req: Request): string {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthenticationError();
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw new AuthenticationError();
  }

  return token;
}

export async function requireAuthenticatedUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service configuration is missing");
  }

  const token = getBearerToken(req);
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const {
    data: { user },
    error,
  } = await serviceClient.auth.getUser(token);

  if (error || !user) {
    throw new AuthenticationError("Invalid or expired session");
  }

  return { user, serviceClient, token };
}

export function hasAdminRole(user: {
  app_metadata?: Record<string, unknown>;
}): boolean {
  const role = user.app_metadata?.role;
  const roles = user.app_metadata?.roles;
  return (
    role === "admin" ||
    (Array.isArray(roles) && roles.some((value) => value === "admin"))
  );
}
