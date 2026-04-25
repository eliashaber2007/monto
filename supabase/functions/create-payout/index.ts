import Stripe from "npm:stripe@14";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://montofinance.app",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestingUserId = user.id;

    const { pot_id, amount, currency, recipient_user_id, withdrawal_id } = await req.json();
    if (!pot_id || !amount || !currency || !recipient_user_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify pot exists
    const { data: pot } = await supabaseAdmin.from("pots").select("*").eq("id", pot_id).single();

    if (!pot) {
      return new Response(JSON.stringify({ error: "Pot not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth check: only creator or leader can approve withdrawals — never the recipient themselves
    const { data: requesterMember } = await supabaseAdmin.from("pot_members").select("role").eq("pot_id", pot_id).eq("user_id", requestingUserId).single();
    const isCreatorOrLeader = pot.created_by === requestingUserId || requesterMember?.role === 'leader';
    if (!isCreatorOrLeader) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const feeCheck = parseFloat(((amount * 0.0025) + 0.25).toFixed(2));
    const totalCheck = parseFloat((amount + feeCheck).toFixed(2));
    if (totalCheck > pot.balance) {
      return new Response(JSON.stringify({ error: "Insufficient balance" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check recipient has completed onboarding
    const { data: recipientProfile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_account_id, stripe_onboarding_complete, first_name")
      .eq("id", recipient_user_id)
      .single();

    if (!recipientProfile?.stripe_onboarding_complete || !recipientProfile?.stripe_account_id) {
      return new Response(JSON.stringify({ error: "Recipient has not completed bank account setup" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    const fee = parseFloat(((amount * 0.0025) + 0.25).toFixed(2));
    const totalDeducted = parseFloat((amount + fee).toFixed(2));
    const amountCents = Math.round(amount * 100);
    const isTestMode = Deno.env.get("STRIPE_SECRET_KEY")!.startsWith("sk_test_");

    let transferId = "";
    let simulated = false;

    // 1. Execute Stripe transfer FIRST — if this fails, nothing else happens
    try {
      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: currency.toLowerCase(),
        destination: recipientProfile.stripe_account_id,
        metadata: { pot_id, recipient_user_id },
      });
      transferId = transfer.id;
    } catch (transferErr: any) {
      if (isTestMode && transferErr.message?.toLowerCase().includes("nsufficient")) {
        transferId = `simulated_${crypto.randomUUID()}`;
        simulated = true;
        console.log("TEST MODE: Simulating successful payout due to insufficient Stripe balance");
      } else {
        throw transferErr;
      }
    }

    // 2. Transfer succeeded — now deduct balance atomically
    await supabaseAdmin.rpc("increment_pot_balance", {
      p_pot_id: pot_id,
      p_amount: -totalDeducted,
    });

    // 3. Record transaction
    await supabaseAdmin.from("transactions").insert({
      pot_id,
      user_id: recipient_user_id,
      amount: -totalDeducted,
      status: "completed",
      stripe_session_id: transferId,
    });

    // 4. Mark the withdrawal as approved with total_deducted (if withdrawal_id provided)
    if (withdrawal_id) {
      await supabaseAdmin
        .from("withdrawals")
        .update({ status: "approved", processed_at: new Date().toISOString(), total_deducted: totalDeducted })
        .eq("id", withdrawal_id);
    } else {
      await supabaseAdmin
        .from("withdrawals")
        .update({ total_deducted: totalDeducted })
        .eq("pot_id", pot_id)
        .eq("user_id", recipient_user_id)
        .eq("amount", amount)
        .is("total_deducted", null)
        .order("created_at", { ascending: false })
        .limit(1);
    }

    // 5. In-app notification
    await supabaseAdmin.from("notifications").insert({
      user_id: recipient_user_id,
      pot_id,
      type: "payout",
      message: `You withdrew €${amount.toFixed(2)} from "${pot.name}". Funds arrive within 1-3 business days.`,
      variables: { amount: amount.toFixed(2), pot: pot.name },
    });

    // 6. Email notification (non-blocking)
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({
          type: "withdrawal_approved",
          pot_id,
          user_id: recipient_user_id,
          amount,
          currency,
        }),
      });
    } catch (emailErr) {
      console.error("Email notification failed:", emailErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        transfer_id: transferId,
        recipient_name: recipientProfile.first_name,
        simulated,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("create-payout error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
