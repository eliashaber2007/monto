import { createClient } from "npm:@supabase/supabase-js@2";

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!serviceRoleKey || !supabaseUrl) {
      console.error("join-pot missing required environment variables");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);

    if (userError || !userData?.user?.id) {
      console.error("join-pot auth validation failed", userError);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const authenticatedUserId = userData.user.id;
    const body = await req.json().catch(() => null);
    const potId = String(body?.pot_id ?? "").trim();
    const requestedUserId = body?.user_id ? String(body.user_id).trim() : authenticatedUserId;

    if (!UUID_RE.test(potId)) {
      return jsonResponse({ error: "Invalid invite link" }, 400);
    }

    if (requestedUserId !== authenticatedUserId) {
      return jsonResponse({ error: "User mismatch" }, 403);
    }

    const { data: existingMembership, error: existingError } = await adminClient
      .from("pot_members")
      .select("id")
      .eq("pot_id", potId)
      .eq("user_id", authenticatedUserId)
      .maybeSingle();

    if (existingError) {
      console.error("join-pot membership check failed", existingError);
      return jsonResponse({ error: "Unable to check membership" }, 500);
    }

    if (existingMembership) {
      return jsonResponse({ pot_id: potId, already_member: true });
    }

    const { error: insertError } = await adminClient
      .from("pot_members")
      .insert({ pot_id: potId, user_id: authenticatedUserId, role: "member" });

    if (insertError) {
      if (insertError.code === "23505") {
        return jsonResponse({ pot_id: potId, already_member: true });
      }

      console.error("join-pot service-role insert failed", insertError);
      return jsonResponse({ error: "Failed to join pot" }, 500);
    }

    return jsonResponse({ pot_id: potId, already_member: false });
  } catch (error) {
    console.error("join-pot unexpected error", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
