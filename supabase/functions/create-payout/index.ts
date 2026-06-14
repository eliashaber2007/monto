// deployed May 26 2026 v3
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const requestingUserId = user.id;
    const { pot_id, amount, currency, recipient_user_id, withdrawal_id } = await req.json();
    if (!pot_id || !amount || !currency || !recipient_user_id || !withdrawal_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: pot } = await supabaseAdmin.from("pots").select("*").eq("id", pot_id).single();
    if (!pot) {
      return new Response(JSON.stringify({ error: "Pot not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const isSelfApprove = pot.withdrawal_rule === 'auto_approve' || pot.withdrawal_rule === 'requires_password';
    if (!isSelfApprove) {
      const { data: requesterMember } = await supabaseAdmin.from("pot_members").select("role").eq("pot_id", pot_id).eq("user_id", requestingUserId).single();
      const isCreatorOrLeader = pot.created_by === requestingUserId || requesterMember?.role === 'leader';
      if (!isCreatorOrLeader) {
        return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      if (requestingUserId !== recipient_user_id) {
        return new Response(JSON.stringify({ error: "You can only process your own withdrawals" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: requesterMember } = await supabaseAdmin.from("pot_members").select("user_id").eq("pot_id", pot_id).eq("user_id", requestingUserId).single();
      if (!requesterMember) {
        return new Response(JSON.stringify({ error: "Not a member of this pot" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    const { data: recipientProfile } = await supabaseAdmin.from("profiles").select("stripe_account_id, stripe_onboarding_complete, first_name").eq("id", recipient_user_id).single();
    if (!recipientProfile?.stripe_onboarding_complete || !recipientProfile?.stripe_account_id) {
      return new Response(JSON.stringify({ error: "Recipient has not completed bank account setup" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: existingWithdrawal } = await supabaseAdmin.from("withdrawals").select("id, payout_id, status").eq("id", withdrawal_id).single();
    if (!existingWithdrawal) {
      return new Response(JSON.stringify({ error: "Withdrawal not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (existingWithdrawal.payout_id && existingWithdrawal.status === "approved") {
      return new Response(JSON.stringify({ success: true, transfer_id: existingWithdrawal.payout_id, recipient_name: recipientProfile.first_name, already_processed: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" as any });
    const fee = parseFloat(((amount * 0.0025) + 0.25).toFixed(2));
    const totalDeducted = parseFloat((amount + fee).toFixed(2));
    const amountCents = Math.round(amount * 100);
    const isTestMode = Deno.env.get("STRIPE_SECRET_KEY")!.startsWith("sk_test_");
    let transferId = "";
    let simulated = false;
    let skipTransfer = false;
    if (existingWithdrawal.payout_id) {
      transferId = existingWithdrawal.payout_id;
      skipTransfer = true;
    }
    if (!skipTransfer) {
      try {
        const transfer = await stripe.transfers.create({ amount: amountCents, currency: currency.toLowerCase(), destination: recipientProfile.stripe_account_id, metadata: { pot_id, recipient_user_id } }, { idempotencyKey: `transfer-${withdrawal_id}` });
        transferId = transfer.id;
        await supabaseAdmin.from("withdrawals").update({ payout_id: transferId }).eq("id", withdrawal_id);
        try {
          await stripe.payouts.create({ amount: amountCents, currency: currency.toLowerCase(), method: "standard" }, { stripeAccount: recipientProfile.stripe_account_id, idempotencyKey: `payout-${withdrawal_id}` });
        } catch (payoutErr: any) {
          console.error("Payout creation failed:", payoutErr?.message);
        }
      } catch (transferErr: any) {
        if (isTestMode && transferErr.message?.toLowerCase().includes("nsufficient")) {
          transferId = `simulated_${crypto.randomUUID()}`;
          simulated = true;
          await supabaseAdmin.from("withdrawals").update({ payout_id: transferId }).eq("id", withdrawal_id);
        } else if (transferErr.message?.toLowerCase().includes("nsufficient")) {
          return new Response(JSON.stringify({ error: "Funds not yet arrived to Stripe, please try again later" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } else {
          throw transferErr;
        }
      }
    }
    let balanceAlreadyDeducted = false;
    if (skipTransfer) {
      const { data: existingTx } = await supabaseAdmin.from("transactions").select("id").eq("stripe_session_id", transferId).maybeSingle();
      if (existingTx) balanceAlreadyDeducted = true;
    }
    if (!balanceAlreadyDeducted) {
      const { error: balanceErr } = await supabaseAdmin.rpc("increment_pot_balance", { p_pot_id: pot_id, p_amount: -totalDeducted });
      if (balanceErr) {
        return new Response(JSON.stringify({ error: "Payout sent but balance update failed.", transfer_id: transferId }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error: txErr } = await supabaseAdmin.from("transactions").insert({ pot_id, user_id: recipient_user_id, amount: -totalDeducted, status: "completed", stripe_session_id: transferId });
      if (txErr) {
        await supabaseAdmin.rpc("increment_pot_balance", { p_pot_id: pot_id, p_amount: totalDeducted });
        return new Response(JSON.stringify({ error: "Failed to record transaction", transfer_id: transferId }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    await supabaseAdmin.from("withdrawals").update({ status: "approved", processed_at: new Date().toISOString(), total_deducted: totalDeducted }).eq("id", withdrawal_id);
    await supabaseAdmin.from("notifications").insert({ user_id: recipient_user_id, pot_id, type: "payout", message: `You withdrew €${amount.toFixed(2)} from "${pot.name}". Funds arrive within 1-3 business days.`, variables: { amount: amount.toFixed(2), pot: pot.name } });
    return new Response(JSON.stringify({ success: true, transfer_id: transferId, recipient_name: recipientProfile.first_name, simulated }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("create-payout error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
