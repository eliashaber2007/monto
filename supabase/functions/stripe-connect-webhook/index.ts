import Stripe from 'npm:stripe@14.21.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' as any });
  const webhookSecret = Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET')!;

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

  console.log(`Received event: ${event.type}`);

  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account;
    
    console.log(`Account ${account.id}: charges_enabled=${account.charges_enabled}, payouts_enabled=${account.payouts_enabled}, details_submitted=${account.details_submitted}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Mark onboarding complete if charges OR details_submitted (Express accounts with eventually_due may not have charges_enabled immediately)
    const isComplete = (account.charges_enabled && account.payouts_enabled) || account.details_submitted;

    if (isComplete) {
      const { data: updateData, error } = await supabaseAdmin
        .from('profiles')
        .update({ stripe_onboarding_complete: true })
        .eq('stripe_account_id', account.id)
        .select('id');

      if (error) {
        console.error('Failed to update onboarding status:', error);
      } else if (!updateData || updateData.length === 0) {
        console.error(`No profile found with stripe_account_id=${account.id}`);
      } else {
        console.log(`Stripe Connect onboarding complete for account ${account.id}, profile ${updateData[0].id}`);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
