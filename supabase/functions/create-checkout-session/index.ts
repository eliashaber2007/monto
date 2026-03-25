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
    // Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub;

    const { pot_id, base_amount_cents, is_new_pot, pot_config, payment_method } = await req.json();

    if (!pot_id || !base_amount_cents || base_amount_cents < 100) {
      return new Response(JSON.stringify({ error: 'Invalid params' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-06-20',
    });

    const origin = req.headers.get('origin') ?? 'https://montofinance.app';

    const resolvedBaseCents = base_amount_cents;

    // Calculate total based on selected payment method
    const isSepa = payment_method === 'sepa';
    let totalCents: number;
    if (isSepa) {
      totalCents = resolvedBaseCents + 70;
    } else {
      totalCents = Math.round(resolvedBaseCents * 1.015 + 25);
    }

    const paymentMethodTypes: string[] = isSepa ? ['sepa_debit'] : ['card'];

    // Build metadata
    const metadata: Record<string, string> = {
      pot_id,
      user_id: userId,
      base_amount_cents: String(resolvedBaseCents),
    };

    if (isSepa) {
      metadata.payment_method = 'sepa';
      // Platform fee = 0.5% of base amount (for logging/reporting only)
      const platformFeeCents = Math.round(resolvedBaseCents * 0.005);
      metadata.platform_fee_cents = String(platformFeeCents);
    }

    // If this is a new pot creation, store pot config in metadata
    if (is_new_pot && pot_config) {
      metadata.is_new_pot = 'true';
      metadata.pot_name = pot_config.name || '';
      metadata.pot_currency = pot_config.currency || 'EUR';
      metadata.pot_goal_amount = String(pot_config.goal_amount ?? '');
      metadata.pot_withdrawal_rule = pot_config.withdrawal_rule || 'auto_approve';
      metadata.pot_withdrawal_password = pot_config.withdrawal_password || '';
      metadata.pot_require_receipt = String(pot_config.require_receipt ?? false);
      metadata.pot_max_withdrawal_amount = String(pot_config.max_withdrawal_amount ?? '');
      metadata.pot_max_withdrawals_per_day = String(pot_config.max_withdrawals_per_day ?? '');
      metadata.pot_emoji = pot_config.emoji || '';
    }

    // Set success/cancel URLs based on whether this is a new pot
    const successUrl = is_new_pot
      ? `${origin}/pot-success?session_id={CHECKOUT_SESSION_ID}`
      : `${origin}/pots/${pot_id}?payment=success`;
    const cancelUrl = is_new_pot
      ? `${origin}/?pot_cancelled=true`
      : `${origin}/pots/${pot_id}?payment=cancelled`;

    // Charge the computed total (base + fee)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: paymentMethodTypes,
      line_items: [
        {
          price_data: {
            currency: (pot_config?.currency || 'eur').toLowerCase(),
            unit_amount: totalCents,
            product_data: { name: is_new_pot ? 'Monto Pot Initial Deposit' : 'Monto Pot Contribution' },
          },
          quantity: 1,
        },
      ],
      metadata,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('create-checkout-session error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
