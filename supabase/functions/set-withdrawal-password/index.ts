import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";
import { getCorsHeaders } from "../_shared/cors.ts";

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
  const corsHeaders = { ...getCorsHeaders(req), "Access-Control-Allow-Methods": "POST, OPTIONS" };
  const jsonResponse = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch((error) => {
      console.error("set-withdrawal-password body parse failed", serializeError(error));
      return null;
    });

    const pot_id = body?.pot_id ? String(body.pot_id).trim() : null;
    const password: string | null = body?.password ?? null;

    if (!pot_id) {
      return jsonResponse({ error: "Missing pot_id" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!serviceRoleKey || !supabaseUrl) {
      console.error("set-withdrawal-password missing environment variables");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    // Service role used for simplicity; all operations here could use the anon client + RLS:
    //   - auth.getUser: works with any client when a user token is passed
    //   - pots.select(created_by): creator can read their own pot via RLS
    //   - pots.update(withdrawal_password): creator updating their own pot, RLS allows it
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);

    if (userError || !userData?.user?.id) {
      console.error("set-withdrawal-password auth failed", serializeError(userError));
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const authenticatedUserId = userData.user.id;

    const { data: pot, error: potError } = await adminClient
      .from("pots")
      .select("created_by")
      .eq("id", pot_id)
      .maybeSingle();

    if (potError || !pot) {
      return jsonResponse({ error: "Pot not found" }, 404);
    }

    if (pot.created_by !== authenticatedUserId) {
      return jsonResponse({ error: "Not authorized" }, 403);
    }

    let hashedPassword: string | null = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 12);
    }

    const { error: updateError } = await adminClient
      .from("pots")
      .update({ withdrawal_password: hashedPassword })
      .eq("id", pot_id);

    if (updateError) {
      console.error("set-withdrawal-password update failed", serializeError(updateError));
      return jsonResponse({ error: "Failed to update password", supabase_error: serializeError(updateError) }, 500);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("set-withdrawal-password unexpected error", serializeError(error));
    return jsonResponse({ error: "Internal server error", details: serializeError(error) }, 500);
  }
});
