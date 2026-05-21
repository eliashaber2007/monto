import Stripe from "npm:stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
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
    if (!pot_id || !amount || !currency || !recipient_user_id || !withdrawal_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role required for:
    //   - profiles.select(recipient): reading another user's Stripe account data
    //   - withdrawals.update: approver updating the recipient's withdrawal record
    //   - notifications.insert: inserting a notification for a different user
    //   - rpc("increment_pot_balance"): balance mutation must run unconditionally, bypassing RLS
    // Could use anon client for: pots.select, own pot_members role check
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

    if (requestingUserId === recipient_user_id) {
      return new Response(JSON.stringify({ error: "You cannot approve your own withdrawal request" }), {
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

    // Check if withdrawal already has a payout_id (prevents duplicate payout on retry)
    const { data: existingWithdrawal } = await supabaseAdmin
      .from("withdrawals")
      .select("id, payout_id, status")
      .eq("id", withdrawal_id)
      .single();

    if (!existingWithdrawal) {
      return new Response(JSON.stringify({ error: "Withdrawal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If already fully processed (payout_id exists AND status is approved), return success immediately
    if (existingWithdrawal.payout_id && existingWithdrawal.status === "approved") {
      console.log(`Withdrawal ${withdrawal_id} already fully processed, returning success`);
      return new Response(
        JSON.stringify({
          success: true,
          transfer_id: existingWithdrawal.payout_id,
          recipient_name: recipientProfile.first_name,
          already_processed: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" as any });
    const fee = parseFloat(((amount * 0.0025) + 0.25).toFixed(2));
    const totalDeducted = parseFloat((amount + fee).toFixed(2));
    const amountCents = Math.round(amount * 100);
    const isTestMode = Deno.env.get("STRIPE_SECRET_KEY")!.startsWith("sk_test_");

    let transferId = "";
    let simulated = false;
    let skipTransfer = false;

    // Check if payout already executed (idempotency for retries)
    if (existingWithdrawal.payout_id) {
      console.log(`Withdrawal ${withdrawal_id} already has payout_id ${existingWithdrawal.payout_id}, skipping Stripe transfer`);
      transferId = existingWithdrawal.payout_id;
      skipTransfer = true;
    }

    // 1. Execute Stripe transfer FIRST — if this fails, nothing else happens
    if (!skipTransfer) {
      try {
        const transfer = await stripe.transfers.create({
          amount: amountCents,
          currency: currency.toLowerCase(),
          destination: recipientProfile.stripe_account_id,
          metadata: { pot_id, recipient_user_id },
        }, { idempotencyKey: `transfer-${withdrawal_id}` });
        transferId = transfer.id;

        // Immediately save payout_id to prevent duplicate payout on retry
        const { error: payoutIdErr } = await supabaseAdmin
          .from("withdrawals")
          .update({ payout_id: transferId })
          .eq("id", withdrawal_id);

        if (payoutIdErr) {
          console.error("Failed to save payout_id after successful transfer:", payoutIdErr);
          // Continue anyway — transfer already executed, this is for idempotency tracking
        }

        // Immediately trigger payout from connected account to user's bank
        try {
          await stripe.payouts.create(
            {
              amount: amountCents,
              currency: currency.toLowerCase(),
              method: "standard",
            },
            { stripeAccount: recipientProfile.stripe_account_id, idempotencyKey: `payout-${withdrawal_id}` },
          );
        } catch (payoutErr: any) {
          console.error("Immediate payout creation failed (transfer succeeded):", payoutErr?.message || payoutErr);
        }
      } catch (transferErr: any) {
        if (isTestMode && transferErr.message?.toLowerCase().includes("nsufficient")) {
          transferId = `simulated_${crypto.randomUUID()}`;
          simulated = true;
          console.log("TEST MODE: Simulating successful payout due to insufficient Stripe balance");

          // Save simulated payout_id
          await supabaseAdmin
            .from("withdrawals")
            .update({ payout_id: transferId })
            .eq("id", withdrawal_id);
        } else {
          throw transferErr;
        }
      }
    }

    // 2. Transfer succeeded — deduct balance with error checking (skip if already done on previous attempt)
    let balanceAlreadyDeducted = false;
    if (skipTransfer) {
      // Check if transaction already exists (means balance was already deducted)
      const { data: existingTx } = await supabaseAdmin
        .from("transactions")
        .select("id")
        .eq("stripe_session_id", transferId)
        .maybeSingle();

      if (existingTx) {
        console.log(`Balance already deducted for withdrawal ${withdrawal_id}, skipping deduction`);
        balanceAlreadyDeducted = true;
      }
    }

    if (!balanceAlreadyDeducted) {
      const { error: balanceErr } = await supabaseAdmin.rpc("increment_pot_balance", {
        p_pot_id: pot_id,
        p_amount: -totalDeducted,
      });
      if (balanceErr) {
        console.error("Balance deduction failed after successful transfer:", balanceErr);
        return new Response(JSON.stringify({ error: "Payout sent but balance update failed. Contact support.", transfer_id: transferId }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 3. Record transaction — roll back balance if this fails
      const { error: txErr } = await supabaseAdmin.from("transactions").insert({
        pot_id,
        user_id: recipient_user_id,
        amount: -totalDeducted,
        status: "completed",
        stripe_session_id: transferId,
      });
      if (txErr) {
        console.error("Transaction insert failed, rolling back balance:", txErr);
        await supabaseAdmin.rpc("increment_pot_balance", { p_pot_id: pot_id, p_amount: totalDeducted });
        return new Response(JSON.stringify({ error: "Failed to record transaction", transfer_id: transferId }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 4. Mark withdrawal approved (idempotent — safe to call multiple times)
    await supabaseAdmin
      .from("withdrawals")
      .update({ status: "approved", processed_at: new Date().toISOString(), total_deducted: totalDeducted })
      .eq("id", withdrawal_id);

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
