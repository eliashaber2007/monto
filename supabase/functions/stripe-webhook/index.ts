import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2024-06-20',
  });

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

  let event: Stripe.Event;

  try {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');
    if (!sig) throw new Error('Missing stripe-signature header');

    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { pot_id, user_id } = session.metadata ?? {};
    const amountTotal = session.amount_total ?? 0; // cents

    if (!pot_id || !user_id) {
      console.error('Missing metadata:', session.metadata);
      return new Response('Missing metadata', { status: 400, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const amountEur = amountTotal / 100;

    // Insert transaction
    const { error: txError } = await supabaseAdmin.from('transactions').insert({
      pot_id,
      user_id,
      amount: amountEur,
      stripe_session_id: session.id,
      status: 'completed',
    });

    if (txError) {
      console.error('Transaction insert error:', txError);
      return new Response(JSON.stringify({ error: txError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update pot balance
    const { error: balanceError } = await supabaseAdmin.rpc('increment_pot_balance', {
      p_pot_id: pot_id,
      p_amount: amountEur,
    });

    if (balanceError) {
      // Fallback: direct update
      const { data: pot } = await supabaseAdmin.from('pots').select('balance').eq('id', pot_id).single();
      await supabaseAdmin.from('pots').update({ balance: (pot?.balance ?? 0) + amountEur }).eq('id', pot_id);
    }

    console.log(`Processed payment: pot=${pot_id} user=${user_id} amount=€${amountEur}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
