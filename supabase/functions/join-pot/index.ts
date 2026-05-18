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

const UUID_RE = /^[0-9a-f-]{36}$/i;

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
      console.error("join-pot request body parse failed", serializeError(error));
      return null;
    });
    const rawPotId = body?.pot_id;
    const potId = String(rawPotId ?? "").trim();
    const requestedUserId = body?.user_id ? String(body.user_id).trim() : null;

    console.log("join-pot called", {
      pot_id: potId || null,
      raw_pot_id: rawPotId ?? null,
      raw_pot_id_type: typeof rawPotId,
      raw_pot_id_json: JSON.stringify(rawPotId ?? null),
      trimmed_pot_id_json: JSON.stringify(potId),
      trimmed_pot_id_length: potId.length,
      has_user_id: Boolean(requestedUserId),
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("join-pot missing bearer authorization header");
      return jsonResponse({ error: "Unauthorized", stage: "authorization_header" }, 401);
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!serviceRoleKey || !supabaseUrl) {
      console.error("join-pot missing required environment variables");
      return jsonResponse({ error: "Server configuration error", stage: "environment" }, 500);
    }

    // Service role required for:
    //   - profiles.upsert: RLS INSERT policy may not fire for OAuth users with no existing row
    //   - profiles.select(creator): reading another user's profile for the join notification
    // Could use anon client for: auth.getUser, own pot_members reads/insert, pots.select (post-join)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);

    console.log("join-pot auth.getUser result", {
      has_user: Boolean(userData?.user?.id),
      user_id: userData?.user?.id ?? null,
      error: serializeError(userError),
    });

    if (userError || !userData?.user?.id) {
      console.error("join-pot auth validation failed", serializeError(userError));
      return jsonResponse({ error: "Unauthorized", stage: "auth_get_user", auth_error: serializeError(userError) }, 401);
    }

    const authenticatedUserId = userData.user.id;
    const effectiveRequestedUserId = requestedUserId ?? authenticatedUserId;

    if (!UUID_RE.test(potId)) {
      console.error("join-pot invalid pot_id", {
        pot_id: potId || null,
        raw_pot_id: rawPotId ?? null,
        raw_pot_id_type: typeof rawPotId,
        raw_pot_id_json: JSON.stringify(rawPotId ?? null),
        trimmed_pot_id_json: JSON.stringify(potId),
        trimmed_pot_id_length: potId.length,
      });
      return jsonResponse({ error: "Invalid invite link", stage: "validate_pot_id", pot_id: potId || null }, 400);
    }

    if (effectiveRequestedUserId !== authenticatedUserId) {
      console.error("join-pot user mismatch", {
        requested_user_id: effectiveRequestedUserId,
        authenticated_user_id: authenticatedUserId,
      });
      return jsonResponse({ error: "User mismatch", stage: "validate_user", requested_user_id: effectiveRequestedUserId, authenticated_user_id: authenticatedUserId }, 403);
    }

    const { data: existingMembership, error: existingError } = await adminClient
      .from("pot_members")
      .select("id")
      .eq("pot_id", potId)
      .eq("user_id", authenticatedUserId)
      .maybeSingle();

    console.log("join-pot existing membership check result", {
      pot_id: potId,
      user_id: authenticatedUserId,
      has_membership: Boolean(existingMembership),
      membership_id: existingMembership?.id ?? null,
      error: serializeError(existingError),
    });

    if (existingError) {
      console.error("join-pot membership check failed", serializeError(existingError));
      return jsonResponse({ error: "Unable to check membership", stage: "membership_check", supabase_error: serializeError(existingError) }, 500);
    }

    const { data: potRow } = await adminClient
      .from("pots")
      .select("name")
      .eq("id", potId)
      .maybeSingle();
    const potName = potRow?.name ?? null;

    if (existingMembership) {
      return jsonResponse({ potId, potName, alreadyMember: true });
    }

    // Ensure a profile row exists for this user (handle_new_user trigger
    // may not have fired for OAuth users). pot_members.user_id has an FK
    // to profiles.id, so a missing row triggers a 23503 violation.
    const userMeta = (userData.user.user_metadata ?? {}) as Record<string, any>;
    const fallbackEmail = userData.user.email ?? "";
    const derivedFirstName =
      userMeta.first_name ||
      userMeta.full_name ||
      userMeta.name ||
      (fallbackEmail ? fallbackEmail.split("@")[0] : "User");
    const derivedAvatar = userMeta.avatar_url || userMeta.picture || null;

    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert(
        { id: authenticatedUserId, first_name: derivedFirstName, avatar_url: derivedAvatar },
        { onConflict: "id", ignoreDuplicates: true },
      );

    if (profileError) {
      console.error("join-pot profile upsert failed", {
        user_id: authenticatedUserId,
        error: serializeError(profileError),
      });
      return jsonResponse({ error: "Failed to ensure profile", stage: "ensure_profile", supabase_error: serializeError(profileError) }, 500);
    }

    const { data: membershipGuard } = await adminClient
      .from("pot_members")
      .select("id")
      .eq("pot_id", potId)
      .eq("user_id", authenticatedUserId)
      .maybeSingle();

    if (membershipGuard) {
      return jsonResponse({ error: "You are already a member of this pot" }, 409);
    }

    const { error: insertError } = await adminClient
      .from("pot_members")
      .insert({ pot_id: potId, user_id: authenticatedUserId, role: "member" });

    if (insertError) {
      console.error("join-pot service-role insert failed", {
        pot_id: potId,
        user_id: authenticatedUserId,
        error: serializeError(insertError),
      });

      if (insertError.code === "23505") {
        return jsonResponse({ potId, potName, alreadyMember: true });
      }

      return jsonResponse({ error: "Failed to join pot", stage: "insert_membership", supabase_error: serializeError(insertError) }, 500);
    }

    console.log("join-pot insert succeeded", { pot_id: potId, user_id: authenticatedUserId });

    try {
      const { data: pot } = await adminClient
        .from("pots")
        .select("id, name, created_by")
        .eq("id", potId)
        .maybeSingle();

      if (pot?.created_by) {
        const { data: creatorProfile } = await adminClient
          .from("profiles")
          .select("email, full_name")
          .eq("id", pot.created_by)
          .maybeSingle();

        const creatorEmail = (creatorProfile as any)?.email ?? null;

        if (creatorEmail) {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email-notification`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "member_joined",
              pot_id: potId,
              user_id: authenticatedUserId,
            }),
          });
        }
      }
    } catch (notifyError) {
      console.error("join-pot member_joined email notification failed", serializeError(notifyError));
    }

    return jsonResponse({ potId, potName, alreadyMember: false });
  } catch (error) {
    console.error("join-pot unexpected error", serializeError(error));
    return jsonResponse({ error: "Internal server error", stage: "unexpected", details: serializeError(error) }, 500);
  }
});
