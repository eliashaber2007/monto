import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface Notification {
  id: string;
  user_id: string;
  pot_id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
}

const EMOJI: Record<string, string> = {
  member_joined: '👋',
  withdrawal_requested: '💸',
  receipt_uploaded: '🧾',
  payout: '🏦',
  withdrawal_approved: '✅',
  withdrawal_rejected: '❌',
  funds_added: '💰',
  expense_reminder: '📋',
  leader_assigned: '⭐',
  leader_removed: '👤',
  mention: '💬',
};

/**
 * Parse dynamic values from the stored English notification message.
 * Returns { name, amount, pot } when possible.
 */
function parseMessage(type: string, message: string): Record<string, string> {
  const params: Record<string, string> = {};

  switch (type) {
    case 'payout': {
      // "You withdrew €123.00 from "Pot Name". Funds arrive..."
      const m = message.match(/withdrew\s*€([\d.,]+)\s*from\s*"([^"]+)"/i);
      if (m) { params.amount = m[1]; params.pot = m[2]; }
      break;
    }
    case 'withdrawal_requested': {
      // "Name requested a withdrawal of €123 from PotName"
      const m = message.match(/^(.+?)\s+requested a withdrawal of\s*€([\d.,]+)\s*from\s+(.+)$/i);
      if (m) { params.name = m[1]; params.amount = m[2]; params.pot = m[3]; }
      break;
    }
    case 'member_joined': {
      // "Name joined PotName"
      const m = message.match(/^(.+?)\s+joined\s+(.+)$/i);
      if (m) { params.name = m[1]; params.pot = m[2]; }
      break;
    }
    case 'withdrawal_approved': {
      // "Your withdrawal of €123 from PotName was approved"
      const m = message.match(/withdrawal of\s*€([\d.,]+)\s*from\s+(.+?)\s+was approved/i);
      if (m) { params.amount = m[1]; params.pot = m[2]; }
      break;
    }
    case 'withdrawal_rejected': {
      // "Your withdrawal of €123 from PotName was rejected"
      const m = message.match(/withdrawal of\s*€([\d.,]+)\s*from\s+(.+?)\s+was rejected/i);
      if (m) { params.amount = m[1]; params.pot = m[2]; }
      break;
    }
    case 'funds_added': {
      // "Name added €123 to PotName"
      const m = message.match(/^(.+?)\s+added\s*€([\d.,]+)\s*to\s+(.+)$/i);
      if (m) { params.name = m[1]; params.amount = m[2]; params.pot = m[3]; }
      break;
    }
    case 'receipt_uploaded': {
      // "Name uploaded a receipt in PotName"
      const m = message.match(/^(.+?)\s+uploaded a receipt in\s+(.+)$/i);
      if (m) { params.name = m[1]; params.pot = m[2]; }
      break;
    }
    case 'expense_reminder': {
      // "PotName: CreatorName is requesting you to justify your withdrawal of €123..."
      const m = message.match(/^(.+?):\s+(.+?)\s+is requesting you to justify your withdrawal of\s*€([\d.,]+)/i);
      if (m) { params.pot = m[1]; params.name = m[2]; params.amount = m[3]; }
      break;
    }
    case 'leader_assigned': {
      // "You've been made a leader of PotName by CreatorName."
      const m = message.match(/leader of\s+(.+?)\s+by\s+(.+?)\.?$/i);
      if (m) { params.pot = m[1]; params.name = m[2]; }
      break;
    }
    case 'leader_removed': {
      // "You are no longer a leader of PotName."
      const m = message.match(/leader of\s+(.+?)\.?$/i);
      if (m) { params.pot = m[1]; }
      break;
    }
    case 'mention': {
      // "Name mentioned you in PotName"
      const m = message.match(/^(.+?)\s+mentioned you in\s+(.+)$/i);
      if (m) { params.name = m[1]; params.pot = m[2]; }
      break;
    }
  }

  return params;
}

function translateMessage(type: string, message: string, t: (key: string, params?: Record<string, string>) => string): string {
  const key = `notifications.msg_${type}`;
  const params = parseMessage(type, message);

  // If we couldn't parse params, fall back to the raw message
  if (Object.keys(params).length === 0) return message;

  const translated = t(key, params);
  // If i18next returns the key itself (missing), fall back to raw message
  if (translated === key) return message;
  return translated;
}

export default function Notifications() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('notifications.justNow');
    if (mins < 60) return t('notifications.minutesAgo', { count: String(mins) });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t('notifications.hoursAgo', { count: String(hrs) });
    const days = Math.floor(hrs / 24);
    return t('notifications.daysAgo', { count: String(days) });
  };

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNotifications(data as Notification[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-page')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => fetchNotifications()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = async () => {
    const allIds = notifications.map((n) => n.id);
    if (allIds.length === 0) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length > 0) {
      await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
    }
    setNotifications([]);
  };

  const handleClick = async (n: Notification) => {
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id);
    }
    navigate(`/pots/${n.pot_id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-foreground text-lg flex-1">{t('notifications.title')}</h1>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
              >
                <CheckCheck size={14} />
                {t('notifications.markAllRead')}
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-muted-foreground font-medium hover:text-foreground hover:underline transition-colors"
              >
                {t('notifications.clearAll')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-20 text-center">
            <span className="text-4xl block mb-3">🔔</span>
            <p className="text-sm text-muted-foreground">{t('notifications.noNotifications')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-secondary/50 transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
              >
                <span className="text-xl mt-0.5">{EMOJI[n.type] ?? '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.read ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                    {translateMessage(n.type, n.message, t)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read && (
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
