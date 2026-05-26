import { createClient } from "npm:@supabase/supabase-js@2";
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
      console.error("create-withdrawal request body parse failed", serializeError(error));
      return null;
    });

    const pot_id = body?.pot_id ? String(body.pot_id).trim() : null;
    const amount = body?.amount != null ? Number(body.amount) : null;
    const note = body?.note ? String(body.note).trim() : null;
    const status = body?.status ? String(body.status).trim() : null;

    if (!pot_id || amount == null || !status) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonResponse({ error: "Invalid amount" }, 400);
    }

    // Validate status can only be 'pending' (prevent status injection)
    if (status !== "pending") {
      return jsonResponse({ error: "Invalid status" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!serviceRoleKey || !supabaseUrl) {
      console.error("create-withdrawal missing required environment variables");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    // Service role used for simplicity; all operations here could use the anon client + RLS:
    //   - auth.getUser: works with any client when a user token is passed
    //   - pots.select(balance): user is a pot member, RLS allows read
    //   - withdrawals.insert: user inserting their own record, RLS allows self-insert
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);

    if (userError || !userData?.user?.id) {
      console.error("create-withdrawal auth validation failed", serializeError(userError));
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const authenticatedUserId = userData.user.id;

    // Call atomic RPC function that checks balance and inserts withdrawal in a single transaction
    const { data, error: rpcError } = await adminClient
      .rpc("create_withdrawal_atomic", {
        p_pot_id: pot_id,
        p_user_id: authenticatedUserId,
        p_amount: amount,
        p_note: note,
        p_status: status,
      });

    console.log('[create-withdrawal] RPC response:', { data, error: rpcError });
    console.log('[create-withdrawal] Raw RPC data type:', Array.isArray(data) ? 'array' : typeof data);
    console.log('[create-withdrawal] Raw RPC data:', JSON.stringify(data, null, 2));

    if (rpcError) {
      console.error("create-withdrawal RPC failed", serializeError(rpcError));

      // Map database exceptions to user-friendly errors
      if (rpcError.message?.includes("Pot not found")) {
        return jsonResponse({ error: "Pot not found" }, 404);
      }

      if (rpcError.message?.includes("Insufficient pot balance")) {
        return jsonResponse({ error: "Withdrawal amount exceeds pot balance" }, 400);
      }

      return jsonResponse({ error: "Failed to create withdrawal", supabase_error: serializeError(rpcError) }, 500);
    }

    // RETURNS TABLE functions return an array
    const withdrawal = Array.isArray(data) ? data[0] : data;

    if (!withdrawal) {
      console.error('[create-withdrawal] No withdrawal returned from RPC');
      return jsonResponse({ error: "Failed to create withdrawal record" }, 500);
    }

    console.log('[create-withdrawal] Extracted withdrawal object:', JSON.stringify(withdrawal, null, 2));
    console.log('[create-withdrawal] Withdrawal ID:', withdrawal?.id);

    return jsonResponse({ withdrawal });
  } catch (error) {
    console.error("create-withdrawal unexpected error", serializeError(error));
    return jsonResponse({ error: "Internal server error", details: serializeError(error) }, 500);
  }
});
