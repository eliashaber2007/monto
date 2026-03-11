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

    const { pot_id, amount_cents, is_new_pot, pot_config } = await req.json();

    if (!pot_id || !amount_cents || amount_cents < 100) {
      return new Response(JSON.stringify({ error: 'Invalid params' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Server-side contribution restriction check for existing pots
    if (!is_new_pot) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { data: potData } = await supabaseAdmin.from('pots').select('contributions_restricted').eq('id', pot_id).single();
      if (potData?.contributions_restricted) {
        const { data: memberData } = await supabaseAdmin.from('pot_members').select('role').eq('pot_id', pot_id).eq('user_id', userId).single();
        if (memberData?.role === 'member') {
          return new Response(JSON.stringify({ error: 'The pot creator has restricted contributions to leaders only.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-06-20',
    });

    const origin = req.headers.get('origin') ?? 'https://id-preview--59da60b6-faa4-4fa4-890f-0b571d3b5fa7.lovable.app';

    // Build metadata
    const metadata: Record<string, string> = {
      pot_id,
      user_id: userId,
    };

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
      metadata.pot_contributions_restricted = String(pot_config.contributions_restricted ?? false);
    }

    // Set success/cancel URLs based on whether this is a new pot
    const successUrl = is_new_pot
      ? `${origin}/pot-success?session_id={CHECKOUT_SESSION_ID}`
      : `${origin}/pots/${pot_id}?payment=success`;
    const cancelUrl = is_new_pot
      ? `${origin}/?pot_cancelled=true`
      : `${origin}/pots/${pot_id}?payment=cancelled`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: (pot_config?.currency || 'eur').toLowerCase(),
            unit_amount: amount_cents,
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
