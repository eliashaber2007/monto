import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const requestingUserId = claimsData.claims.sub;

    const { pot_id, amount, currency, recipient_user_id } = await req.json();

    if (!pot_id || !amount || !currency || !recipient_user_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify requesting user is pot creator or the recipient
    const { data: pot } = await supabaseAdmin.from('pots').select('*').eq('id', pot_id).single();
    if (!pot) {
      return new Response(JSON.stringify({ error: 'Pot not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (pot.created_by !== requestingUserId && requestingUserId !== recipient_user_id) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (amount > pot.balance) {
      return new Response(JSON.stringify({ error: 'Insufficient balance' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check recipient has completed onboarding
    const { data: recipientProfile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, stripe_onboarding_complete, first_name')
      .eq('id', recipient_user_id)
      .single();

    if (!recipientProfile?.stripe_onboarding_complete || !recipientProfile?.stripe_account_id) {
      return new Response(JSON.stringify({ error: 'Recipient has not completed bank account setup' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });

    // Create transfer to connected account
    const amountCents = Math.round(amount * 100);
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!;
    const isTestMode = stripeKey.startsWith('sk_test_');
    let transferId = '';
    let simulated = false;

    try {
      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: currency.toLowerCase(),
        destination: recipientProfile.stripe_account_id,
        metadata: { pot_id, recipient_user_id },
      });
      transferId = transfer.id;
    } catch (transferErr: any) {
      if (isTestMode && transferErr.message?.includes('nsufficient')) {
        // Simulate success in test mode when balance is insufficient
        transferId = `simulated_${crypto.randomUUID()}`;
        simulated = true;
        console.log('TEST MODE: Simulating successful payout due to insufficient Stripe balance');
      } else {
        throw transferErr;
      }
    }

    // Deduct from pot balance
    await supabaseAdmin.rpc('increment_pot_balance', {
      p_pot_id: pot_id,
      p_amount: -amount,
    });

    // Record transaction
    await supabaseAdmin.from('transactions').insert({
      pot_id,
      user_id: recipient_user_id,
      amount: -amount,
      status: 'completed',
      stripe_session_id: transferId,
    });

    // Send notification to recipient
    await supabaseAdmin.from('notifications').insert({
      user_id: recipient_user_id,
      pot_id,
      type: 'payout',
      message: `You received €${amount.toFixed(2)} from "${pot.name}".${simulated ? ' (Test mode – simulated)' : ' Funds arrive within 1-3 business days.'}`,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      transfer_id: transferId,
      recipient_name: recipientProfile.first_name,
      simulated,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('create-payout error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
