import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const allowedOrigin = "https://montofinance.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function serializeError(error: any) {
  if (!error) return null;
  return {
    code: error.code ?? null,
    message: error.message ?? String(error),
    details: error.details ?? null,
    hint: error.hint ?? null,
    status: error.status ?? null,
    name: error.name ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch((error) => {
      console.error("verify-withdrawal-password body parse failed", serializeError(error));
      return null;
    });

    const pot_id = body?.pot_id ? String(body.pot_id).trim() : null;
    const password: string | null = body?.password ? String(body.password) : null;

    if (!pot_id || !password) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!serviceRoleKey || !supabaseUrl) {
      console.error("verify-withdrawal-password missing environment variables");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    // Service role required for:
    //   - pots.select(withdrawal_password): the bcrypt hash must never be returned to the client;
    //     a RLS policy exposing this column to members would allow offline cracking attempts.
    //     SR keeps the hash server-side and the compare happens here, never in the browser.
    // Could use anon client for: auth.getUser
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);

    if (userError || !userData?.user?.id) {
      console.error("verify-withdrawal-password auth failed", serializeError(userError));
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: pot, error: potError } = await adminClient
      .from("pots")
      .select("withdrawal_password")
      .eq("id", pot_id)
      .maybeSingle();

    if (potError || !pot) {
      return jsonResponse({ error: "Pot not found" }, 404);
    }

    if (!pot.withdrawal_password) {
      return jsonResponse({ valid: false });
    }

    const valid = await bcrypt.compare(password, pot.withdrawal_password);

    return jsonResponse({ valid });
  } catch (error) {
    console.error("verify-withdrawal-password unexpected error", serializeError(error));
    return jsonResponse({ error: "Internal server error", details: serializeError(error) }, 500);
  }
});
