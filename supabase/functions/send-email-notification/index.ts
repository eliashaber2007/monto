import { Resend } from 'npm:resend@4.0.1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://montofinance.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function getUserEmail(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) return null;
  return data.user.email;
}

async function getProfile(userId: string) {
  const { data } = await supabaseAdmin.from('profiles').select('first_name').eq('id', userId).single();
  return data;
}

async function getPot(potId: string) {
  const { data } = await supabaseAdmin.from('pots').select('name, created_by, balance, currency').eq('id', potId).single();
  return data;
}

async function getPotMemberCount(potId: string): Promise<number> {
  const { count } = await supabaseAdmin.from('pot_members').select('id', { count: 'exact', head: true }).eq('pot_id', potId);
  return count ?? 0;
}

async function getPotMemberUserIds(potId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.from('pot_members').select('user_id').eq('pot_id', potId);
  return data?.map((m: any) => m.user_id) ?? [];
}

function formatCurrency(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
}

interface EmailPayload {
  type: 'member_joined' | 'withdrawal_requested' | 'withdrawal_approved' | 'funds_added' | 'pot_closed' | 'expense_reminder' | 'mention' | 'leader_assigned' | 'leader_removed';
  pot_id: string;
  user_id?: string;
  amount?: number;
  currency?: string;
  creator_name?: string;
}

async function hasPushSubscription(userId: string): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return (count ?? 0) > 0;
}

async function sendEmailIfNoPush(userId: string, to: string, subject: string, body: string) {
  if (await hasPushSubscription(userId)) return;
  await sendEmail(to, subject, body);
}

async function sendEmail(to: string, subject: string, body: string) {
  try {
    const { error } = await resend.emails.send({
      from: 'Monto <notifications@resend.dev>',
      to: [to],
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="color: #1a1a1a; margin-bottom: 16px;">${subject}</h2>
          <p style="color: #333; font-size: 15px; line-height: 1.6;">${body}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Sent by Monto</p>
        </div>
      `,
    });
    if (error) {
      console.error('Resend error:', error);
    }
  } catch (err) {
    console.error('Email send failed:', err);
  }
}

async function sendPush(userId: string, title: string, body: string, url: string) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ user_id: userId, title, body, url }),
    });
  } catch (err) {
    console.error('Push notification failed:', err);
  }
}

async function handleNotification(payload: EmailPayload) {
  const pot = await getPot(payload.pot_id);
  if (!pot) { console.error('Pot not found:', payload.pot_id); return; }

  const currency = payload.currency || pot.currency || 'EUR';
  const potUrl = `/pots/${payload.pot_id}`;

  switch (payload.type) {
    case 'member_joined': {
      const profile = payload.user_id ? await getProfile(payload.user_id) : null;
      const name = profile?.first_name || 'Someone';
      const creatorEmail = await getUserEmail(pot.created_by);
      if (!creatorEmail) break;
      const memberCount = await getPotMemberCount(payload.pot_id);
      const subject = `${name} joined your pot ${pot.name}`;
      await sendEmailIfNoPush(
        pot.created_by,
        creatorEmail,
        subject,
        `${name} has just joined your pot <strong>${pot.name}</strong>. You now have <strong>${memberCount}</strong> members.`,
      );
      await sendPush(pot.created_by, pot.name, `${name} joined your pot`, potUrl);
      break;
    }

    case 'withdrawal_requested': {
      const profile = payload.user_id ? await getProfile(payload.user_id) : null;
      const name = profile?.first_name || 'Someone';

      const creatorEmail = await getUserEmail(pot.created_by);
      if (creatorEmail) {
        await sendEmailIfNoPush(pot.created_by, creatorEmail, `Withdrawal request in ${pot.name}`, `${name} has requested a withdrawal of <strong>${formatCurrency(payload.amount ?? 0, currency)}</strong> from <strong>${pot.name}</strong>. Log in to approve or reject it.`);
        await sendPush(pot.created_by, pot.name, `${name} requested a withdrawal of ${formatCurrency(payload.amount ?? 0, currency)}`, potUrl);
      }

      const { data: leaders } = await supabaseAdmin.from('pot_members').select('user_id').eq('pot_id', payload.pot_id).eq('role', 'leader');
      for (const leader of (leaders ?? [])) {
        if (leader.user_id === payload.user_id) continue;
        const leaderEmail = await getUserEmail(leader.user_id);
        if (leaderEmail) {
          await sendEmailIfNoPush(leader.user_id, leaderEmail, `Withdrawal request in ${pot.name}`, `${name} has requested a withdrawal of <strong>${formatCurrency(payload.amount ?? 0, currency)}</strong> from <strong>${pot.name}</strong>. Log in to approve or reject it.`);
        }
        await sendPush(leader.user_id, pot.name, `${name} requested a withdrawal of ${formatCurrency(payload.amount ?? 0, currency)}`, potUrl);
      }
      break;
    }

    case 'withdrawal_approved': {
      if (!payload.user_id) break;
      const recipientEmail = await getUserEmail(payload.user_id);
      if (!recipientEmail) break;
      await sendEmailIfNoPush(
        payload.user_id,
        recipientEmail,
        'Your withdrawal has been approved',
        `Your withdrawal of <strong>${formatCurrency(payload.amount ?? 0, currency)}</strong> from <strong>${pot.name}</strong> has been approved. Funds will arrive within 1-3 business days.`,
      );
      await sendPush(payload.user_id, pot.name, `Your withdrawal of ${formatCurrency(payload.amount ?? 0, currency)} has been approved ✅`, potUrl);
      break;
    }

    case 'funds_added': {
      const profile = payload.user_id ? await getProfile(payload.user_id) : null;
      const name = profile?.first_name || 'Someone';
      const creatorEmail = await getUserEmail(pot.created_by);
      if (!creatorEmail) break;
      await sendEmailIfNoPush(
        pot.created_by,
        creatorEmail,
        `${name} added ${formatCurrency(payload.amount ?? 0, currency)} to ${pot.name}`,
        `${name} added <strong>${formatCurrency(payload.amount ?? 0, currency)}</strong> to your pot <strong>${pot.name}</strong>. The new balance is <strong>${formatCurrency(pot.balance, currency)}</strong>.`,
      );
      await sendPush(pot.created_by, pot.name, `${name} added ${formatCurrency(payload.amount ?? 0, currency)}`, potUrl);
      break;
    }

    case 'pot_closed': {
      const memberIds = await getPotMemberUserIds(payload.pot_id);
      for (const memberId of memberIds) {
        const email = await getUserEmail(memberId);
        if (!email) continue;
        await sendEmailIfNoPush(
          memberId,
          email,
          `${pot.name} has been closed`,
          `The pot <strong>${pot.name}</strong> has been closed by the creator. Your share of the funds will be processed shortly.`,
        );
        await sendPush(memberId, pot.name, `${pot.name} has been closed`, '/');
      }
      break;
    }

    case 'expense_reminder': {
      if (!payload.user_id) break;
      const creatorName = payload.creator_name || 'The pot creator';
      const reminderMessage = `${pot.name}: ${creatorName} is requesting you to justify your withdrawal of ${formatCurrency(payload.amount ?? 0, currency)}. Please add your expenses and receipts.`;

      await supabaseAdmin.from('notifications').insert({
        user_id: payload.user_id,
        pot_id: payload.pot_id,
        type: 'expense_reminder',
        message: reminderMessage,
        variables: { name: creatorName, amount: String(payload.amount ?? 0), pot: pot.name },
      });

      const recipientEmail = await getUserEmail(payload.user_id);
      if (recipientEmail) {
        await sendEmailIfNoPush(
          payload.user_id,
          recipientEmail,
          `Justify your withdrawal in ${pot.name}`,
          `${creatorName} is requesting you to justify your withdrawal of <strong>${formatCurrency(payload.amount ?? 0, currency)}</strong> from <strong>${pot.name}</strong>. Please add your expenses and receipts.`,
        );
      }
      await sendPush(payload.user_id, pot.name, reminderMessage, potUrl);
      break;
    }

    case 'mention': {
      if (!payload.user_id) break;
      const senderName = payload.creator_name || 'Someone';
      const mentionMessage = `${senderName} mentioned you in ${pot.name}`;
      await sendPush(payload.user_id, pot.name, mentionMessage, potUrl);
      break;
    }

    case 'leader_assigned': {
      if (!payload.user_id) break;
      const creatorName = payload.creator_name || 'The creator';
      const message = `You've been made a leader of ${pot.name} by ${creatorName}.`;

      await supabaseAdmin.from('notifications').insert({
        user_id: payload.user_id,
        pot_id: payload.pot_id,
        type: 'leader_assigned',
        message,
        variables: { name: creatorName, pot: pot.name },
      });

      const recipientEmail = await getUserEmail(payload.user_id);
      if (recipientEmail) {
        await sendEmailIfNoPush(payload.user_id, recipientEmail, `You're now a leader of ${pot.name}`, `${creatorName} has made you a leader of <strong>${pot.name}</strong>. You can now approve withdrawals and manage the pot.`);
      }
      await sendPush(payload.user_id, pot.name, message, potUrl);
      break;
    }

    case 'leader_removed': {
      if (!payload.user_id) break;
      const removedMessage = `You are no longer a leader of ${pot.name}.`;

      await supabaseAdmin.from('notifications').insert({
        user_id: payload.user_id,
        pot_id: payload.pot_id,
        type: 'leader_removed',
        message: removedMessage,
        variables: { pot: pot.name },
      });

      const removedEmail = await getUserEmail(payload.user_id);
      if (removedEmail) {
        await sendEmailIfNoPush(payload.user_id, removedEmail, `Leader role removed in ${pot.name}`, `You are no longer a leader of <strong>${pot.name}</strong>.`);
      }
      await sendPush(payload.user_id, pot.name, removedMessage, potUrl);
      break;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: EmailPayload = await req.json();
    handleNotification(payload).catch((err) => console.error('Notification handler error:', err));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('send-email-notification error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
