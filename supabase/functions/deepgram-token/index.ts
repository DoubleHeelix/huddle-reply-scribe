/// <reference types="https://deno.land/x/deno/runtime.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import supabaseJs from "https://esm.sh/@supabase/supabase-js@2.50.0/dist/umd/supabase.js?target=deno&deno-std=0.168.0";

const { createClient } = supabaseJs;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get and validate the user's authentication token
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError) {
      console.error("User authentication error:", userError);
      return new Response(JSON.stringify({ error: "Authentication failed" }), { status: 401, headers: corsHeaders });
    }
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 401, headers: corsHeaders });
    }

    // Proceed with Deepgram logic only if the user is authenticated
    const deepgramApiKey = Deno.env.get("DEEPGRAM_API_KEY");
    if (!deepgramApiKey) {
      throw new Error("DEEPGRAM_API_KEY is not set in environment variables.");
    }

    const deepgramUrl = "https://api.deepgram.com/v1/projects/5e33b10d-1e3c-4b31-98cb-3a5c543b3b3d/keys";

    const response = await fetch(deepgramUrl, {
      method: "POST",
      headers: {
        "Authorization": `Token ${deepgramApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment: "Temporary key for HuddlePlay Scribe",
        scopes: ["usage:write"],
        time_to_live_in_seconds: 600,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Deepgram API request failed. Status:", response.status, "Body:", errorBody);
      return new Response(
        JSON.stringify({ error: `Deepgram API Error: ${errorBody}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    return new Response(JSON.stringify({ key: data.key }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in deepgram-token function:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
