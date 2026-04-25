import Stripe from 'npm:stripe@14.21.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2024-06-20' as any,
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
    return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata ?? {};
    const { pot_id, user_id } = metadata;
    const amountTotal = session.amount_total ?? 0;

    if (!pot_id || !user_id) {
      console.error('Missing metadata:', metadata);
      return new Response('Missing metadata', { status: 400 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Idempotency check — if this session was already processed, return 200 immediately
    const { data: existingTx } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('stripe_session_id', session.id)
      .maybeSingle();

    if (existingTx) {
      console.log('Duplicate webhook event, already processed:', session.id);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const baseAmountCents = metadata.base_amount_cents ? parseInt(metadata.base_amount_cents) : amountTotal;
    const amountEur = baseAmountCents / 100;

    console.log(`Payment received: total_charged=${amountTotal}c, base_amount=${baseAmountCents}c, pot_receives=€${amountEur}`);

    // If this is a new pot creation, create the pot first
    if (metadata.is_new_pot === 'true') {
      const { data: existingPot } = await supabaseAdmin
        .from('pots')
        .select('id')
        .eq('id', pot_id)
        .maybeSingle();

      if (!existingPot) {
        const goalAmount = metadata.pot_goal_amount ? parseFloat(metadata.pot_goal_amount) : null;
        const maxWdAmount = metadata.pot_max_withdrawal_amount ? parseFloat(metadata.pot_max_withdrawal_amount) : null;
        const maxWdPerDay = metadata.pot_max_withdrawals_per_day ? parseInt(metadata.pot_max_withdrawals_per_day) : null;

        const { error: potError } = await supabaseAdmin.from('pots').insert({
          id: pot_id,
          name: metadata.pot_name || 'Untitled Pot',
          created_by: user_id,
          visual_style: 'progress_ring',
          currency: metadata.pot_currency || 'EUR',
          goal_amount: isNaN(goalAmount as number) ? null : goalAmount,
          withdrawal_rule: metadata.pot_withdrawal_rule || 'auto_approve',
          require_receipt: metadata.pot_require_receipt === 'true',
          max_withdrawal_amount: isNaN(maxWdAmount as number) ? null : maxWdAmount,
          max_withdrawals_per_day: isNaN(maxWdPerDay as number) ? null : maxWdPerDay,
          emoji: metadata.pot_emoji || null,
        });

        if (potError) {
          console.error('Error creating pot in webhook:', potError);
          return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        await supabaseAdmin.from('pot_members').insert({
          pot_id,
          user_id,
          role: 'creator',
        });

        console.log(`Created new pot ${pot_id} via webhook`);
      }
    }

    // Insert transaction with BASE amount
    const { error: txError } = await supabaseAdmin.from('transactions').insert({
      pot_id,
      user_id,
      amount: amountEur,
      stripe_session_id: session.id,
      status: 'completed',
    });

    if (txError) {
      console.error('Transaction insert error:', txError);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update pot balance with BASE amount only
    const { error: balanceError } = await supabaseAdmin.rpc('increment_pot_balance', {
      p_pot_id: pot_id,
      p_amount: amountEur,
    });

    if (balanceError) {
      const { data: pot } = await supabaseAdmin.from('pots').select('balance').eq('id', pot_id).single();
      await supabaseAdmin.from('pots').update({ balance: (pot?.balance ?? 0) + amountEur }).eq('id', pot_id);
    }

    console.log(`Processed payment: pot=${pot_id} user=${user_id} pot_receives=€${amountEur}`);

    // Send email notification for funds added
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({
          type: 'funds_added',
          pot_id,
          user_id,
          amount: amountEur,
        }),
      });
    } catch (emailErr) {
      console.error('Email notification failed:', emailErr);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
