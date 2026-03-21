import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Users, Plus, CheckCircle2, Image as ImageIcon, Upload, X, LogOut, Copy, Check, Landmark, ThumbsUp, ThumbsDown, MessageCircle, KeyRound, ChevronDown, ChevronRight, Receipt, Bell, FileDown } from 'lucide-react';
import { generatePotReport } from '@/lib/generatePotReport';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePotDetail } from '@/hooks/usePots';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import AddFundsModal from '@/components/AddFundsModal';
import ReceiptUploadModal from '@/components/ReceiptUploadModal';
import ReceiptReviewModal from '@/components/ReceiptReviewModal';
import WithdrawalModal from '@/components/WithdrawalModal';
import PotChat from '@/components/PotChat';
import ChangePasswordModal from '@/components/ChangePasswordModal';

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IE', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function ReceiptStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: 'Receipt Pending', color: 'bg-warning/10 text-warning border-warning/20' },
    submitted: { label: 'Submitted', color: 'bg-primary/10 text-primary border-primary/20' },
    approved: { label: 'Approved', color: 'bg-success/10 text-success border-success/20' },
    rejected: { label: 'Rejected', color: 'bg-destructive/10 text-destructive border-destructive/20' },
    expired: { label: 'Unverified', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  };
  const cfg = map[status] ?? map.pending;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function getBalanceFontSize(text: string): number {
  const len = text.length;
  if (len <= 4) return 32;
  if (len <= 6) return 28;
  if (len <= 8) return 24;
  if (len <= 10) return 20;
  if (len <= 12) return 18;
  return 16;
}

function computeStreak(transactions: { created_at: string; amount: number }[]): number {
  if (!transactions.length) return 0;
  // Get unique dates with deposits (positive amounts)
  const depositDates = new Set(
    transactions
      .filter((t) => t.amount > 0)
      .map((t) => new Date(t.created_at).toDateString())
  );
  if (depositDates.size === 0) return 0;

  let streak = 0;
  const today = new Date();
  const check = new Date(today);

  // Start from today, go backwards
  while (true) {
    if (depositDates.has(check.toDateString())) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else if (streak === 0) {
      // If today has no contribution, try starting from yesterday
      check.setDate(check.getDate() - 1);
      if (depositDates.has(check.toDateString())) {
        streak++;
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return streak;
}

function ProgressRing({ balance, peakBalance, currency }: { balance: number; peakBalance: number; currency: string }) {
  const radius = 88;
  const stroke = 10;
  const norm = radius - stroke / 2;
  const circ = 2 * Math.PI * norm;
  const hasPeak = peakBalance > 0;
  const pct = hasPeak ? Math.min(balance / peakBalance, 1) : 0;

  const formatted = formatCurrency(balance, currency);
  const fontSize = getBalanceFontSize(formatted);

  return (
    <>
      <div className="relative flex items-center justify-center w-52 h-52 mx-auto">
        <svg className="absolute" width={208} height={208} viewBox="0 0 208 208">
          {hasPeak && (
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(221,83%,68%)" />
                <stop offset="100%" stopColor="hsl(221,83%,45%)" />
              </linearGradient>
            </defs>
          )}
          <circle cx={104} cy={104} r={norm} fill="none" stroke="hsl(214,32%,91%)" strokeWidth={stroke} />
          {hasPeak && (
            <circle
              cx={104} cy={104} r={norm}
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - pct)}
              transform="rotate(-90 104 104)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          )}
        </svg>
        <div className="text-center z-10 px-3 max-w-[164px]">
          <div className="font-bold text-foreground leading-tight" style={{ fontSize }}>{formatted}</div>
        </div>
      </div>
      {hasPeak && (() => {
        const pctVal = Math.round(pct * 100);
        const pctColor = pctVal >= 50 ? 'text-emerald-400' : pctVal >= 20 ? 'text-amber-400' : 'text-red-500';
        return (
          <div className={`text-xs text-center mt-2 font-semibold ${pctColor}`}>
            {pctVal}% of {formatCurrency(peakBalance, currency)}
          </div>
        );
      })()}
    </>
  );
}

export default function PotDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, refetch } = usePotDetail(id);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [showUpload, setShowUpload] = useState<string | null>(null);
  const [showReview, setShowReview] = useState<any | null>(null);
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showConnectBankDialog, setShowConnectBankDialog] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [connectingBank, setConnectingBank] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [processingWithdrawal, setProcessingWithdrawal] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [fundsOpen, setFundsOpen] = useState(true);
  const [withdrawalsOpen, setWithdrawalsOpen] = useState(true);
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});
  const [withdrawalExpenses, setWithdrawalExpenses] = useState<Record<string, number>>({});
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [assigningLeader, setAssigningLeader] = useState<string | null>(null);
  const [approveConfirm, setApproveConfirm] = useState<any | null>(null);
  const [rejectConfirm, setRejectConfirm] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  const inviteLink = `https://montofinance.app/invite/${id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      toast({ title: '🎉 Payment successful!', description: 'Your balance will update shortly.' });
      // Multiple staggered refetches to catch webhook processing
      refetch();
      setTimeout(() => refetch(), 1500);
      setTimeout(() => refetch(), 3000);
      setTimeout(() => refetch(), 6000);
      setSearchParams({}, { replace: true });
    } else if (payment === 'cancelled') {
      toast({ title: 'Payment cancelled', description: 'No funds were added.', variant: 'destructive' });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const fetchReceipts = useCallback(() => {
    if (!id) return;
    supabase.from('receipts').select('*').eq('pot_id', id).order('created_at', { ascending: false })
      .then(({ data }) => setReceipts(data ?? []));
  }, [id]);

  const fetchWithdrawals = useCallback(() => {
    if (!id) return;
    console.log('[Withdrawals] Fetching withdrawals for pot:', id);
    supabase.from('withdrawals').select('*').eq('pot_id', id).order('created_at', { ascending: false })
      .then(({ data }) => {
        console.log('[Withdrawals] Fetched', data?.length ?? 0, 'withdrawals:', data?.map(w => ({ id: w.id, status: w.status, amount: w.amount })));
        setWithdrawals(data ?? []);
      });
  }, [id]);

  // Re-fetch on window/tab focus
  useEffect(() => {
    const onFocus = () => {
      refetch();
      fetchWithdrawals();
    };
    const onVisChange = () => {
      if (document.visibilityState === 'visible') onFocus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [refetch, fetchWithdrawals]);

  // Initial fetch
  useEffect(() => {
    fetchReceipts();
    fetchWithdrawals();
  }, [id, fetchReceipts, fetchWithdrawals]);

  // Realtime subscriptions
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`pot-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pots', filter: `id=eq.${id}` }, (payload) => {
        console.log('[Realtime] Pot updated:', payload);
        refetch();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `pot_id=eq.${id}` }, (payload) => {
        console.log('[Realtime] New transaction:', payload);
        refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals', filter: `pot_id=eq.${id}` }, (payload) => {
        console.log('[Realtime] Withdrawal change:', payload);
        // Immediate fetch + delayed fetch to catch any lag
        fetchWithdrawals();
        refetch();
        setTimeout(() => { fetchWithdrawals(); refetch(); }, 1000);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, refetch, fetchWithdrawals]);

  // Fetch expense totals per withdrawal
  useEffect(() => {
    if (withdrawals.length === 0) return;
    const wIds = withdrawals.map((w: any) => w.id);
    supabase
      .from('withdrawal_expenses')
      .select('withdrawal_id, amount')
      .in('withdrawal_id', wIds)
      .then(({ data }) => {
        const totals: Record<string, number> = {};
        (data ?? []).forEach((e: any) => {
          totals[e.withdrawal_id] = (totals[e.withdrawal_id] ?? 0) + Number(e.amount);
        });
        setWithdrawalExpenses(totals);
      });
  }, [withdrawals]);

  const toggleMemberExpand = (memberId: string) => {
    setExpandedMembers((prev) => ({ ...prev, [memberId]: !prev[memberId] }));
  };

  // Unread chat count
  useEffect(() => {
    if (!id || !user) return;
    const fetchUnread = async () => {
      const { data: readData } = await supabase
        .from('pot_chat_reads')
        .select('last_read_at')
        .eq('pot_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      const lastRead = (readData as any)?.last_read_at ?? '1970-01-01T00:00:00Z';
      const { count } = await supabase
        .from('pot_messages')
        .select('*', { count: 'exact', head: true })
        .eq('pot_id', id)
        .gt('created_at', lastRead)
        .neq('user_id', user.id);
      setUnreadChatCount(count ?? 0);
    };
    fetchUnread();
    // Also re-check when chat closes
    const channel = supabase
      .channel(`pot-chat-unread-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pot_messages', filter: `pot_id=eq.${id}` }, () => {
        if (!showChat) fetchUnread();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, user, showChat]);

  const handleApproveWithdrawal = async (withdrawal: any) => {
    console.log('[Approve] Starting approval for withdrawal:', withdrawal.id, 'amount:', withdrawal.amount, 'status:', withdrawal.status);
    if (withdrawal.user_id === user?.id) {
      toast({ title: 'Error', description: 'You cannot approve your own withdrawal request.', variant: 'destructive' });
      return;
    }
    if (withdrawal.status !== 'pending') {
      toast({ title: 'Error', description: 'This withdrawal is no longer pending.', variant: 'destructive' });
      return;
    }
    setProcessingWithdrawal(withdrawal.id);
    try {
      // 1. Call create-payout FIRST — this deducts balance and triggers bank transfer atomically
      //    Do NOT mark as approved until payout succeeds
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            pot_id: id,
            amount: withdrawal.amount,
            currency: (data?.pot.currency ?? 'EUR').toLowerCase(),
            recipient_user_id: withdrawal.user_id,
            withdrawal_id: withdrawal.id,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Payout failed');

      // 2. Payout succeeded — mark withdrawal as approved
      await supabase.from('withdrawals').update({ status: 'approved', processed_at: new Date().toISOString() }).eq('id', withdrawal.id);

      toast({ title: 'Withdrawal approved ✅' });
      setApproveConfirm(null);
      refetch();
      fetchWithdrawals();
    } catch (err: any) {
      // Payout failed — withdrawal stays pending, balance untouched
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessingWithdrawal(null);
    }
  };

  const handleRejectWithdrawal = async (withdrawal: any, reason: string) => {
    if (withdrawal.user_id === user?.id) {
      toast({ title: 'Error', description: 'You cannot reject your own withdrawal request.', variant: 'destructive' });
      return;
    }
    setProcessingWithdrawal(withdrawal.id);
    try {
      await supabase.from('withdrawals').update({ status: 'rejected', processed_at: new Date().toISOString() }).eq('id', withdrawal.id);

      // Send rejection notification to the requester
      try {
        const potName = data?.pot?.name || 'the pot';
        const { data: sessionData } = await supabase.auth.getSession();
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData?.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({ type: 'withdrawal_rejected', pot_id: id, user_id: withdrawal.user_id, amount: withdrawal.amount, reason }),
        });
      } catch (e) { console.error('Rejection notification failed:', e); }

      toast({ title: 'Withdrawal rejected ❌' });
      setRejectConfirm(null);
      setRejectReason('');
      refetch();
      fetchWithdrawals();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessingWithdrawal(null);
    }
  };

  const handleAssignLeader = async (member: any) => {
    setAssigningLeader(member.id);
    try {
      const memberProfile = (member as any)?.profiles;
      const memberName = memberProfile?.first_name || 'Member';
      const { count } = await supabase.from('pot_members').select('id', { count: 'exact', head: true }).eq('pot_id', id!).eq('role', 'leader');
      if ((count ?? 0) >= 3) { toast({ title: 'You can only have up to 3 leaders per pot.', variant: 'destructive' }); setAssigningLeader(null); return; }
      const { error } = await supabase.from('pot_members').update({ role: 'leader' }).eq('id', member.id);
      if (error) throw error;
      try {
        const { data: creatorProfile } = await supabase.from('profiles').select('first_name').eq('id', user!.id).single();
        const { data: sessionData } = await supabase.auth.getSession();
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-notification`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData?.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({ type: 'leader_assigned', pot_id: id, user_id: member.user_id, creator_name: creatorProfile?.first_name || 'The creator' }),
        });
      } catch (e) { console.error('Leader notification failed:', e); }
      toast({ title: `${memberName} is now a leader of this pot.` });
      refetch();
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); } finally { setAssigningLeader(null); }
  };

  const handleRemoveLeader = async (member: any) => {
    setAssigningLeader(member.id);
    try {
      const memberProfile = (member as any)?.profiles;
      const memberName = memberProfile?.first_name || 'Member';
      const { error } = await supabase.from('pot_members').update({ role: 'member' }).eq('id', member.id);
      if (error) throw error;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-notification`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData?.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({ type: 'leader_removed', pot_id: id, user_id: member.user_id }),
        });
      } catch (e) { console.error('Leader removal notification failed:', e); }
      toast({ title: `${memberName} is no longer a leader.` });
      refetch();
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); } finally { setAssigningLeader(null); }
  };

  const handleLeavePot = async () => {
    setLeaving(true);
    const { error } = await supabase
      .from('pot_members')
      .delete()
      .eq('pot_id', id!)
      .eq('user_id', user!.id);
    setLeaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['pots'] });
    toast({ title: 'Left pot', description: 'You have left this pot.' });
    navigate('/');
  };

  const handleConnectBank = async () => {
    setConnectingBank(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-connect-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to start onboarding');

      window.location.href = result.url;
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setConnectingBank(false);
    }
  };

  const handleClosePot = async () => {
    if (!user || !data) return;
    setClosing(true);

    // Check if creator has completed Stripe onboarding
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('stripe_onboarding_complete')
      .eq('id', user.id)
      .single();

    if (!(creatorProfile as any)?.stripe_onboarding_complete) {
      setClosing(false);
      setShowCloseDialog(false);
      setShowConnectBankDialog(true);
      return;
    }

    const pot = data.pot;
    const currency = pot.currency ?? 'EUR';
    const balance = pot.balance ?? 0;

    try {
      if (balance > 0) {
        // Call create-payout
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payout`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              pot_id: id,
              amount: balance,
              currency: currency.toLowerCase(),
              recipient_user_id: user.id,
            }),
          }
        );

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Payout failed');
      }

      // Set pot status to closed
      const { error } = await supabase.from('pots').update({ status: 'closed' }).eq('id', id!);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['pots'] });
      toast({
        title: 'Pot closed 🎉',
        description: balance > 0
          ? `${formatCurrency(balance, currency)} has been transferred to your bank account. Funds arrive within 1-3 business days.`
          : 'The pot has been closed.',
      });
      navigate('/');
    } catch (err: any) {
      toast({ title: 'Error closing pot', description: err.message, variant: 'destructive' });
    } finally {
      setClosing(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { pot, members, transactions, myRole } = data;
  const isCreator = myRole === 'creator';
  const isLeader = myRole === 'leader';
  const isCreatorOrLeader = isCreator || isLeader;
  const currency = pot.currency ?? 'EUR';

  const receiptByTx: Record<string, any> = {};
  receipts.forEach(r => { if (r.transaction_id) receiptByTx[r.transaction_id] = r; });

  return (
    <div className="min-h-screen pb-28 bg-background">
      {/* Sticky top bar */}
      <div className="bg-card border-b border-border sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {(pot as any).emoji && <span className="text-lg flex-shrink-0">{(pot as any).emoji}</span>}
              <h1 className="font-bold text-foreground truncate text-lg">{pot.name}</h1>
              <span className={`flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                isCreator ? 'bg-accent text-primary border-primary/20' : isLeader ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700' : 'bg-accent text-primary border-primary/20'
              }`}>
                {isCreator ? t('potDetail.creatorRole') : isLeader ? t('potDetail.leaderRole') : t('potDetail.memberRole')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChat(true)}
              className="relative flex items-center gap-1.5 text-xs text-primary font-semibold border border-primary/30 rounded-full px-3 py-1.5 hover:bg-accent transition-colors"
            >
              <MessageCircle size={13} />
              {t('potDetail.chat')}
              {unreadChatCount > 0 && (
                <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 ml-0.5">
                  {unreadChatCount > 99 ? '99+' : unreadChatCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-1.5 text-xs text-primary font-semibold border border-primary/30 rounded-full px-3 py-1.5 hover:bg-accent transition-colors"
            >
              <Users size={13} />
              {t('potDetail.invite')}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-8 space-y-6">
        {/* Ring + balance */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
          <ProgressRing balance={pot.balance ?? 0} peakBalance={((pot as any).peak_balance > 0 ? (pot as any).peak_balance : pot.balance) ?? 0} currency={currency} />
          {((pot as any).peak_balance <= 0 && pot.balance <= 0) && !pot.goal_amount && (
            <p className="text-sm text-muted-foreground mt-4">{t('potDetail.noGoalSet')}</p>
          )}
          {pot.require_receipt && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-warning font-medium bg-warning/10 px-2.5 py-1 rounded-full border border-warning/20">
              <CheckCircle2 size={11} />
              {t('potDetail.receiptVerification')}
            </div>
          )}
        </div>

        {/* Action row */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-12 rounded-xl font-semibold border-primary text-primary hover:bg-primary/10" onClick={() => setShowWithdrawal(true)}>
            {t('potDetail.requestWithdrawal')}
          </Button>
          {(!(pot as any).contributions_restricted || isCreatorOrLeader) ? (
            <Button variant="secondary" className="flex-1 h-12 rounded-xl font-semibold bg-muted text-foreground hover:bg-muted/80" onClick={() => setShowAddFunds(true)}>
              <Plus size={16} className="mr-1" />
              {t('potDetail.addFunds')}
            </Button>
          ) : (
            <div className="flex-1 h-12 rounded-xl bg-muted/50 flex items-center justify-center text-xs text-muted-foreground text-center px-2">
              {t('potDetail.contributionsRestricted')}
            </div>
          )}
        </div>

        {/* Generate Report - creator only */}
        {isCreator && (
          <div className="flex justify-end">
            <button
              onClick={async () => {
                setGeneratingReport(true);
                try {
                  // Fetch all transactions (not just 50)
                  const { data: allTx } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('pot_id', id!)
                    .eq('status', 'completed')
                    .order('created_at', { ascending: false });

                  // Fetch all approved withdrawals
                  const { data: allW } = await supabase
                    .from('withdrawals')
                    .select('*')
                    .eq('pot_id', id!)
                    .eq('status', 'approved')
                    .order('created_at', { ascending: false });

                  // Fetch all expenses for approved withdrawals
                  const approvedIds = (allW ?? []).map(w => w.id);
                  let allExpenses: any[] = [];
                  if (approvedIds.length > 0) {
                    const { data: expData } = await supabase
                      .from('withdrawal_expenses')
                      .select('*')
                      .in('withdrawal_id', approvedIds);
                    allExpenses = expData ?? [];
                  }

                  generatePotReport(pot, members, allTx ?? [], allW ?? [], allExpenses);
                  toast({ title: t('potDetail.reportDownloaded') });
                } catch (e) {
                  console.error('Report generation failed:', e);
                  toast({ title: t('potDetail.reportFailed'), variant: 'destructive' });
                } finally {
                  setGeneratingReport(false);
                }
              }}
              disabled={generatingReport}
              className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium hover:text-foreground transition-colors disabled:opacity-50"
            >
              <FileDown size={14} />
              {generatingReport ? t('potDetail.generating') : t('potDetail.generateReport')}
            </button>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="activity" onValueChange={(val) => { if (val === 'activity') { console.log('[Tabs] Activity tab focused, re-fetching withdrawals'); fetchWithdrawals(); refetch(); } }}>
          <TabsList className="w-full rounded-xl p-1 h-11 pot-tabs-list">
            <TabsTrigger value="activity" className="pot-tab-trigger flex-1 rounded-lg text-sm">{t('potDetail.activity')}</TabsTrigger>
            <TabsTrigger value="members" className="pot-tab-trigger flex-1 rounded-lg text-sm">{t('potDetail.members')}</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="mt-5 space-y-3">
            {(() => {
              const deposits = transactions.filter((tx) => Number(tx.amount) > 0);
              const withdrawalTxs = transactions.filter((tx) => Number(tx.amount) < 0);
              const totalDeposits = deposits.reduce((s, tx) => s + Number(tx.amount), 0);
              const totalWithdrawals = withdrawals.reduce((s, w) => s + Number((w as any).total_deducted || w.amount), 0);

              const getMemberProfile = (userId: string) => {
                const m = members.find((m) => m.user_id === userId);
                return (m as any)?.profiles;
              };

              const MemberAvatar = ({ userId }: { userId: string }) => {
                const profile = getMemberProfile(userId);
                const avatarUrl = profile?.avatar_url;
                const avatarColor = profile?.avatar_color || '#3b82f6';
                const initial = (profile?.first_name || '?')[0].toUpperCase();
                if (avatarUrl) {
                  return <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />;
                }
                return (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: avatarColor }}>
                    {initial}
                  </div>
                );
              };

              return (
                <>
                  {/* Funds Added section */}
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <button
                      onClick={() => setFundsOpen((v) => !v)}
                      className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                      type="button"
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <span>💳</span>
                        <span>{t('potDetail.fundsAdded')}</span>
                        <span className="text-muted-foreground font-normal">·</span>
                        <span className="text-success">{formatCurrency(totalDeposits, currency)}</span>
                        <span className="text-muted-foreground font-normal">·</span>
                        <span className="text-muted-foreground font-normal text-xs">{deposits.length} {deposits.length !== 1 ? t('potDetail.transactions') : t('potDetail.transaction')}</span>
                      </div>
                      <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${fundsOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {fundsOpen && (
                      <div className="border-t border-border divide-y divide-border">
                        {deposits.length === 0 ? (
                          <div className="p-4 text-center text-xs text-muted-foreground">{t('potDetail.noContributions')}</div>
                        ) : deposits.map((tx) => {
                          const profile = getMemberProfile(tx.user_id);
                          const name = profile?.first_name || 'Member';
                          return (
                            <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                              <MemberAvatar userId={tx.user_id} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{name}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
                              </div>
                              <span className="text-sm font-bold text-success">+{formatCurrency(Number(tx.amount), currency)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Withdrawals section */}
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <button
                      onClick={() => setWithdrawalsOpen((v) => !v)}
                      className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                      type="button"
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <span>💸</span>
                        <span>{t('potDetail.withdrawals')}</span>
                        <span className="text-muted-foreground font-normal">·</span>
                        <span className="text-destructive">{formatCurrency(totalWithdrawals, currency)}</span>
                        <span className="text-muted-foreground font-normal">·</span>
                        <span className="text-muted-foreground font-normal text-xs">{withdrawals.length} {withdrawals.length !== 1 ? t('potDetail.transactions') : t('potDetail.transaction')}</span>
                      </div>
                      <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${withdrawalsOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {withdrawalsOpen && (
                      <div className="border-t border-border divide-y divide-border">
                        {withdrawals.length === 0 ? (
                          <div className="p-4 text-center text-xs text-muted-foreground">{t('potDetail.noWithdrawals')}</div>
                        ) : withdrawals.map((w) => {
                          const profile = getMemberProfile(w.user_id);
                          const name = profile?.first_name || 'Member';
                          const isMyRequest = w.user_id === user?.id;
                          const isPending = w.status === 'pending';
                          const statusLabel = isPending ? t('potDetail.pending') : w.status === 'approved' ? t('potDetail.approved') : t('potDetail.rejected');
                          const statusColor = isPending
                            ? 'text-warning bg-warning/10 border-warning/20'
                            : w.status === 'approved'
                              ? 'text-success bg-success/10 border-success/20'
                              : 'text-destructive bg-destructive/10 border-destructive/20';

                          return (
                            <div key={w.id} className="px-4 py-3 space-y-2">
                              <div className="flex items-center gap-3">
                                <MemberAvatar userId={w.user_id} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{name}</p>
                                  <p className="text-xs text-muted-foreground">{formatDate(w.processed_at || w.created_at)}</p>
                                  {w.note && <p className="text-xs text-muted-foreground mt-0.5 italic">"{w.note}"</p>}
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                  <span className="text-sm font-bold text-destructive">-{formatCurrency(Number((w as any).total_deducted || w.amount), currency)}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${statusColor}`}>
                                    {statusLabel}
                                  </span>
                                  {isMyRequest ? (
                                    <button
                                      onClick={() => navigate(`/expenses/${w.id}`)}
                                      className="text-xs flex items-center gap-1.5 text-primary-foreground font-semibold bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors mt-0.5"
                                    >
                                      <Receipt size={12} />
                                       {t('potDetail.justifyExpenses')}
                                    </button>
                                  ) : isCreatorOrLeader ? (
                                    <button
                                      onClick={() => navigate(`/expenses/${w.id}`)}
                                      className="text-xs flex items-center gap-1.5 text-primary-foreground font-semibold bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors mt-0.5"
                                    >
                                      <Receipt size={12} />
                                       {t('potDetail.viewJustifiedExpenses')}
                                    </button>
                                  ) : null}
                                  {/* Send reminder button for creator/leader when expenses not fully justified */}
                                  {isCreatorOrLeader && !isMyRequest && w.status === 'approved' && (withdrawalExpenses[w.id] ?? 0) < Number(w.amount) && (
                                    <button
                                      onClick={async () => {
                                        setSendingReminder(w.id);
                                        try {
                                          const creatorProfile = getMemberProfile(user!.id);
                                          const creatorName = creatorProfile?.first_name || 'The pot creator';

                                          // Send reminder via edge function (handles both notification insert and email)
                                          const { data: sessionData } = await supabase.auth.getSession();
                                          const token = sessionData?.session?.access_token;
                                          await fetch(
                                            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-notification`,
                                            {
                                              method: 'POST',
                                              headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${token}`,
                                                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                                              },
                                              body: JSON.stringify({
                                                type: 'expense_reminder',
                                                pot_id: pot.id,
                                                user_id: w.user_id,
                                                amount: Number(w.amount),
                                                creator_name: creatorName,
                                              }),
                                            }
                                          );

                                          toast({ title: t('potDetail.reminderSent') });
                                        } catch (err: any) {
                                          toast({ title: 'Error', description: err.message, variant: 'destructive' });
                                        } finally {
                                          setSendingReminder(null);
                                        }
                                      }}
                                      disabled={sendingReminder === w.id}
                                      className="text-xs flex items-center gap-1.5 text-warning font-semibold bg-warning/10 border border-warning/20 px-3 py-1.5 rounded-lg hover:bg-warning/20 transition-colors mt-0.5 disabled:opacity-50"
                                    >
                                      <Bell size={12} />
                                      {sendingReminder === w.id ? t('potDetail.sending') : t('potDetail.sendReminder')}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Creator/Leader approve/reject for pending (not own requests) */}
                              {isPending && isCreatorOrLeader && !isMyRequest && (
                                <div className="flex gap-2 ml-11">
                                  <button
                                    onClick={() => setApproveConfirm(w)}
                                    disabled={processingWithdrawal === w.id}
                                    className="flex-1 text-xs font-semibold py-2 rounded-lg bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors disabled:opacity-50"
                                  >
                                    {processingWithdrawal === w.id ? t('potDetail.processing') : t('potDetail.approve')}
                                  </button>
                                  <button
                                    onClick={() => { setRejectConfirm(w); setRejectReason(''); }}
                                    disabled={processingWithdrawal === w.id}
                                    className="flex-1 text-xs font-semibold py-2 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors disabled:opacity-50"
                                  >
                                     {t('potDetail.reject')}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Created card */}
                  <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                      <span className="text-base">🎉</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{t('potDetail.created', { name: pot.name })}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(pot.created_at)}</p>
                    </div>
                  </div>
                </>
              );
            })()}
          </TabsContent>

          <TabsContent value="members" className="mt-5 space-y-3 max-w-sm mx-auto">
            {members.map((m) => {
              const memberProfile = (m as any).profiles;
              const memberName = memberProfile?.first_name || 'Member';
              const memberAvatar = memberProfile?.avatar_url;
              const memberColor = memberProfile?.avatar_color || '#3b82f6';
              const initial = memberName[0]?.toUpperCase() || '?';
              const isExpanded = expandedMembers[m.id] ?? false;
              const memberWithdrawals = withdrawals.filter((w: any) => w.user_id === m.user_id);
              const totalWithdrawn = memberWithdrawals.reduce((s: number, w: any) => s + Number(w.amount), 0);
              const totalJustified = memberWithdrawals.reduce((s: number, w: any) => s + (withdrawalExpenses[w.id] ?? 0), 0);
              const overallJustifiedPct = totalWithdrawn > 0 ? Math.min(Math.round((totalJustified / totalWithdrawn) * 100), 100) : 0;

              return (
                <div key={m.id} className="bg-card rounded-xl border border-border overflow-hidden">
                  <button
                    onClick={() => toggleMemberExpand(m.id)}
                    className="w-full p-4 flex items-center gap-3 text-left hover:bg-accent/30 transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                      style={{ backgroundColor: memberAvatar ? undefined : memberColor }}
                    >
                      {memberAvatar ? (
                        <img src={memberAvatar} alt={memberName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-sm">{initial}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {m.user_id === user?.id ? `${memberName} (${t('common.you')})` : memberName}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                    </div>
                    {m.role === 'creator' && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-primary border border-primary/20 font-semibold">
                        {t('potDetail.creatorRole')}
                      </span>
                    )}
                    {m.role === 'leader' && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700 font-semibold">
                        {t('potDetail.leaderRole')}
                      </span>
                    )}
                    <ChevronDown
                      size={16}
                      className={`text-muted-foreground transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                      {memberWithdrawals.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">{t('potDetail.noWithdrawals')}</p>
                      ) : (
                        <>
                          <p className="text-xs font-semibold text-muted-foreground">
                            {t('potDetail.withdrawalSummary', { count: memberWithdrawals.length, total: formatCurrency(totalWithdrawn, currency), pct: overallJustifiedPct })}
                          </p>
                          {memberWithdrawals.map((w: any) => {
                            const expTotal = withdrawalExpenses[w.id] ?? 0;
                            const pct = Number(w.amount) > 0 ? Math.min(Math.round((expTotal / Number(w.amount)) * 100), 100) : 0;
                            const statusMap: Record<string, { label: string; cls: string }> = {
                              pending: { label: t('potDetail.pending'), cls: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700' },
                              approved: { label: t('potDetail.approved'), cls: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700' },
                              rejected: { label: t('potDetail.rejected'), cls: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700' },
                            };
                            const st = statusMap[w.status] ?? statusMap.pending;
                            const canJustify = w.user_id === user?.id;

                            return (
                              <div key={w.id} className="bg-muted/40 rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-bold text-destructive">-{formatCurrency(Number(w.amount), currency)}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${st.cls}`}>{st.label}</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground">{formatDate(w.created_at)}</p>
                                {w.note && <p className="text-xs text-foreground/80 italic">"{w.note}"</p>}
                                <div className="space-y-1">
                                  <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-primary transition-all duration-300"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">{t('potDetail.justifiedPct', { pct, current: formatCurrency(expTotal, currency), total: formatCurrency(Number(w.amount), currency) })}</p>
                                </div>
                                {canJustify ? (
                                  <button
                                    onClick={() => navigate(`/expenses/${w.id}`)}
                                    className="text-xs flex items-center gap-1.5 text-primary-foreground font-semibold bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
                                  >
                                    <Receipt size={12} />
                                    {t('potDetail.justifyExpenses')}
                                  </button>
                                ) : isCreatorOrLeader ? (
                                  <button
                                    onClick={() => navigate(`/expenses/${w.id}`)}
                                    className="text-xs flex items-center gap-1.5 text-muted-foreground font-semibold bg-muted px-3 py-1.5 rounded-lg hover:bg-muted/80 transition-colors"
                                  >
                                    <Receipt size={12} />
                                    {t('potDetail.viewJustifiedExpenses')}
                                  </button>
                                ) : null}
                              </div>
                            );
                          })}
                        </>
                      )}
                      {/* Leader assignment - creator only */}
                      {isCreator && m.role !== 'creator' && m.user_id !== user?.id && (
                        <div className="pt-2 border-t border-border">
                          {m.role === 'member' ? (
                            <button
                              onClick={() => handleAssignLeader(m)}
                              disabled={assigningLeader === m.id}
                              className="text-xs flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50"
                            >
                              ⭐ {assigningLeader === m.id ? t('potDetail.assigningLeader') : t('potDetail.assignAsLeader')}
                            </button>
                          ) : m.role === 'leader' ? (
                            <button
                              onClick={() => handleRemoveLeader(m)}
                              disabled={assigningLeader === m.id}
                              className="text-xs flex items-center gap-1.5 font-semibold text-destructive bg-destructive/10 border border-destructive/20 px-3 py-1.5 rounded-lg hover:bg-destructive/20 transition-colors disabled:opacity-50"
                            >
                              {assigningLeader === m.id ? t('potDetail.removingLeader') : t('potDetail.removeAsLeader')}
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>
        </Tabs>

        {/* Bottom action buttons */}
        <div className="pt-4 space-y-3">
          {isCreator && pot.withdrawal_rule === 'requires_password' && (
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl font-semibold text-sm"
              onClick={() => setShowChangePassword(true)}
            >
              <KeyRound size={15} className="mr-2" />
              {t('potDetail.changeWithdrawalPassword')}
            </Button>
          )}
          {isCreator ? (
            <Button
              variant="destructive"
              className="w-full h-12 rounded-xl font-semibold text-base"
              onClick={() => setShowCloseDialog(true)}
            >
              <X size={16} className="mr-2" />
              {t('potDetail.closePot')}
            </Button>
          ) : (
            <Button
              variant="destructive"
              className="w-full h-12 rounded-xl font-semibold text-base"
              onClick={() => setShowLeaveDialog(true)}
            >
              <LogOut size={16} className="mr-2" />
              {t('potDetail.leavePot')}
            </Button>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="max-w-[320px] rounded-2xl p-6 gap-0">
          <div className="flex flex-col items-center gap-5">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users size={22} className="text-primary" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-foreground">{t('potDetail.inviteTo', { name: pot.name })}</h3>
              <p className="text-xs text-muted-foreground">{t('potDetail.anyoneWithLink')}</p>
            </div>
            <Button
              className="w-full h-11 rounded-xl font-semibold"
              onClick={handleCopyLink}
            >
              {copied ? (
                <><Check size={16} className="mr-1.5" /> {t('potDetail.copied')}</>
              ) : (
                <><Copy size={16} className="mr-1.5" /> {t('potDetail.copyInviteLink')}</>
              )}
            </Button>
            <Button
              className="w-full h-11 rounded-xl font-semibold bg-[#25D366] hover:bg-[#1da851] text-white"
              onClick={() => {
                const message = t('potDetail.whatsappMessage', { name: pot.name, link: inviteLink });
                window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 mr-1.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              {t('potDetail.shareViaWhatsapp')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Pot Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('potDetail.leaveQuestion')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('potDetail.leaveDescription', { name: pot.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeavePot}
              disabled={leaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leaving ? 'Leaving…' : 'Leave Pot'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close Pot Dialog (Creator only) */}
      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this pot?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently close "{pot.name}". The remaining funds of {formatCurrency(pot.balance ?? 0, currency)} will be transferred to your bank account. Funds arrive within 1-3 business days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClosePot}
              disabled={closing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {closing ? 'Processing…' : 'Close Pot'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Connect Bank Account Dialog */}
      <AlertDialog open={showConnectBankDialog} onOpenChange={setShowConnectBankDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bank account required</AlertDialogTitle>
            <AlertDialogDescription>
              You need to connect your bank account before closing a pot. This is required to receive your funds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConnectBank}
              disabled={connectingBank}
            >
              <Landmark size={15} className="mr-1.5" />
              {connectingBank ? 'Redirecting…' : 'Connect Bank Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Withdrawal Confirmation */}
      <AlertDialog open={!!approveConfirm} onOpenChange={(v) => { if (!v) setApproveConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve withdrawal?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this withdrawal of {approveConfirm ? formatCurrency(Number(approveConfirm.amount), currency) : ''}? This will trigger a bank transfer to the member and deduct the amount from the pot balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => approveConfirm && handleApproveWithdrawal(approveConfirm)}
              disabled={!!processingWithdrawal}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              {processingWithdrawal ? 'Processing…' : 'Approve ✅'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Withdrawal Confirmation */}
      <Dialog open={!!rejectConfirm} onOpenChange={(v) => { if (!v) { setRejectConfirm(null); setRejectReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject withdrawal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for rejecting this withdrawal of {rejectConfirm ? formatCurrency(Number(rejectConfirm.amount), currency) : ''}.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setRejectConfirm(null); setRejectReason(''); }}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={!rejectReason.trim() || !!processingWithdrawal}
                onClick={() => rejectConfirm && handleRejectWithdrawal(rejectConfirm, rejectReason.trim())}
              >
                {processingWithdrawal ? 'Processing…' : 'Reject ❌'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modals */}
      <WithdrawalModal
        open={showWithdrawal}
        onOpenChange={(v) => {
          setShowWithdrawal(v);
          if (!v) {
            refetch();
            fetchWithdrawals();
          }
        }}
        potId={id!}
        potBalance={pot.balance ?? 0}
        currency={currency}
        withdrawalRule={pot.withdrawal_rule ?? 'auto_approve'}
        withdrawalPassword={pot.withdrawal_password}
        potName={pot.name}
        createdBy={pot.created_by}
        maxWithdrawalAmount={(pot as any).max_withdrawal_amount}
        maxWithdrawalsPerDay={(pot as any).max_withdrawals_per_day}
        myRole={myRole}
      />

      <AddFundsModal
        open={showAddFunds}
        onOpenChange={(v) => {
          setShowAddFunds(v);
          if (!v) {
            refetch();
          }
        }}
        potId={id!}
        potName={pot.name}
        currency={currency}
        restricted={(pot as any).contributions_restricted && !isCreatorOrLeader}
      />

      {showUpload && (
        <ReceiptUploadModal
          open={!!showUpload}
          onOpenChange={(v) => { if (!v) setShowUpload(null); }}
          potId={id!}
          transactionId={showUpload}
          windowDays={pot.receipt_window_days ?? 7}
          onUploaded={() => {
            setShowUpload(null);
            fetchReceipts();
          }}
        />
      )}

      {showReview && (
        <ReceiptReviewModal
          open={!!showReview}
          onOpenChange={(v) => { if (!v) setShowReview(null); }}
          receipt={showReview}
          potId={id!}
          onReviewed={() => {
            setShowReview(null);
            fetchReceipts();
          }}
        />
      )}

      {showChat && (
        <PotChat
          potId={id!}
          potName={pot?.name ?? 'the pot'}
          potEmoji={(pot as any)?.emoji}
          members={members}
          onClose={() => setShowChat(false)}
        />
      )}

      <ChangePasswordModal
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
        potId={id!}
        currentPassword={pot.withdrawal_password ?? null}
        onChanged={() => refetch()}
      />
    </div>
  );
}
