import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Users, Plus, CheckCircle2, Image as ImageIcon, Upload, X, LogOut, Copy, Check, Landmark, ThumbsUp, ThumbsDown, MessageCircle } from 'lucide-react';
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

function ProgressRing({ balance, goal, currency, transactions }: { balance: number; goal?: number | null; currency: string; transactions?: { created_at: string; amount: number }[] }) {
  const radius = 88;
  const stroke = 10;
  const norm = radius - stroke / 2;
  const circ = 2 * Math.PI * norm;
  const hasGoal = goal != null && goal > 0;
  const pct = hasGoal ? Math.min(balance / goal!, 1) : 0;

  const formatted = formatCurrency(balance, currency);
  const fontSize = getBalanceFontSize(formatted);
  

  return (
    <>
      <div className="relative flex items-center justify-center w-52 h-52 mx-auto">
        <svg className="absolute" width={208} height={208} viewBox="0 0 208 208">
          {hasGoal && (
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(221,83%,68%)" />
                <stop offset="100%" stopColor="hsl(221,83%,45%)" />
              </linearGradient>
            </defs>
          )}
          <circle cx={104} cy={104} r={norm} fill="none" stroke="hsl(214,32%,91%)" strokeWidth={stroke} />
          {hasGoal && (
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
      {hasGoal && (() => {
        const pctVal = Math.min(Math.round((balance / goal!) * 100), 100);
        const pctColor = pctVal >= 50 ? 'text-green-500' : pctVal >= 20 ? 'text-orange-500' : 'text-red-500';
        return (
          <div className={`text-xs text-center mt-2 font-semibold ${pctColor}`}>
            {pctVal}% of {formatCurrency(goal!, currency)}
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
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const inviteLink = `https://preview--pot-pal-finance.lovable.app/join/${id}`;

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
      setTimeout(() => refetch(), 3000);
      setSearchParams({}, { replace: true });
    } else if (payment === 'cancelled') {
      toast({ title: 'Payment cancelled', description: 'No funds were added.', variant: 'destructive' });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`pot-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pots', filter: `id=eq.${id}` }, () => refetch())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `pot_id=eq.${id}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, refetch]);

  const fetchReceipts = () => {
    if (!id) return;
    supabase.from('receipts').select('*').eq('pot_id', id).order('created_at', { ascending: false })
      .then(({ data }) => setReceipts(data ?? []));
  };

  const fetchWithdrawals = () => {
    if (!id) return;
    supabase.from('withdrawals').select('*').eq('pot_id', id).order('created_at', { ascending: false })
      .then(({ data }) => setWithdrawals(data ?? []));
  };

  useEffect(() => {
    fetchReceipts();
    fetchWithdrawals();
  }, [id]);

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
    setProcessingWithdrawal(withdrawal.id);
    try {
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
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Payout failed');

      await supabase.from('withdrawals').update({ status: 'approved', processed_at: new Date().toISOString() }).eq('id', withdrawal.id);

      toast({ title: 'Withdrawal approved ✅' });
      refetch();
      fetchWithdrawals();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessingWithdrawal(null);
    }
  };

  const handleRejectWithdrawal = async (withdrawal: any) => {
    setProcessingWithdrawal(withdrawal.id);
    try {
      // Refund balance
      await supabase.rpc('increment_pot_balance', {
        p_pot_id: id!,
        p_amount: withdrawal.amount,
      });

      await supabase.from('withdrawals').update({ status: 'rejected', processed_at: new Date().toISOString() }).eq('id', withdrawal.id);

      toast({ title: 'Withdrawal rejected ❌', description: 'Funds returned to pot.' });
      refetch();
      fetchWithdrawals();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessingWithdrawal(null);
    }
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
              <h1 className="font-bold text-foreground truncate text-lg">{pot.name}</h1>
              <span className="flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-accent text-primary border border-primary/20 font-semibold">
                {isCreator ? '👑 Creator' : '👤 Member'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChat(true)}
              className="relative flex items-center gap-1.5 text-xs text-primary font-semibold border border-primary/30 rounded-full px-3 py-1.5 hover:bg-accent transition-colors"
            >
              <MessageCircle size={13} />
              Chat
              {unreadChatCount > 0 && (
                <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 ml-0.5">
                  {unreadChatCount > 99 ? '99+' : unreadChatCount}
                </span>
              )}
            </button>
            {isCreator && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-1.5 text-xs text-primary font-semibold border border-primary/30 rounded-full px-3 py-1.5 hover:bg-accent transition-colors"
              >
                <Users size={13} />
                Invite
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-8 space-y-6">
        {/* Ring + balance */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
          <ProgressRing balance={pot.balance ?? 0} goal={pot.goal_amount} currency={currency} transactions={transactions} />
          {!pot.goal_amount && (
            <p className="text-sm text-muted-foreground mt-4">No goal set — save as much as you like! 🎯</p>
          )}
          {pot.require_receipt && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-warning font-medium bg-warning/10 px-2.5 py-1 rounded-full border border-warning/20">
              <CheckCircle2 size={11} />
              Receipt verification enabled
            </div>
          )}
        </div>

        {/* Action row */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-12 rounded-xl font-semibold border-primary text-primary hover:bg-primary/10" onClick={() => setShowWithdrawal(true)}>
            Request Withdrawal
          </Button>
          <Button variant="secondary" className="flex-1 h-12 rounded-xl font-semibold bg-muted text-foreground hover:bg-muted/80" onClick={() => setShowAddFunds(true)}>
            <Plus size={16} className="mr-1" />
            Add Funds
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="activity">
          <TabsList className="w-full bg-secondary rounded-xl p-1 h-11">
            <TabsTrigger value="activity" className="flex-1 rounded-lg text-sm data-[state=inactive]:text-muted-foreground dark:data-[state=inactive]:text-[#B0B8C9]">Activity</TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex-1 rounded-lg text-sm data-[state=inactive]:text-muted-foreground dark:data-[state=inactive]:text-[#B0B8C9]">Leaderboard</TabsTrigger>
            <TabsTrigger value="members" className="flex-1 rounded-lg text-sm data-[state=inactive]:text-muted-foreground dark:data-[state=inactive]:text-[#B0B8C9]">Members</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="mt-5 space-y-3">
            {/* Pending withdrawal requests (visible to all, actionable by creator) */}
            {withdrawals.filter((w) => w.status === 'pending').map((w) => {
              const memberData = members.find((m) => m.user_id === w.user_id);
              const profile = (memberData as any)?.profiles;
              const requesterName = profile?.first_name || 'Member';
              const isMyRequest = w.user_id === user?.id;

              return (
                <div key={w.id} className="bg-warning/5 rounded-xl border border-warning/30 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-base">⏳</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {isMyRequest ? 'Your withdrawal request' : `${requesterName} requested withdrawal`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(w.amount, currency)} • {formatDate(w.created_at)}
                      </p>
                      {w.note && <p className="text-xs text-muted-foreground mt-1 italic">"{w.note}"</p>}
                    </div>
                    <div className="flex-shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20 font-semibold">
                        Pending
                      </span>
                    </div>
                  </div>
                  {isCreator && !isMyRequest && (
                    <div className="flex gap-2 mt-3 ml-12">
                      <button
                        onClick={() => handleApproveWithdrawal(w)}
                        disabled={processingWithdrawal === w.id}
                        className="flex-1 text-xs font-semibold py-2 rounded-lg bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors disabled:opacity-50"
                      >
                        {processingWithdrawal === w.id ? 'Processing…' : 'Approve ✅'}
                      </button>
                      <button
                        onClick={() => handleRejectWithdrawal(w)}
                        disabled={processingWithdrawal === w.id}
                        className="flex-1 text-xs font-semibold py-2 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors disabled:opacity-50"
                      >
                        Reject ❌
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Resolved withdrawal requests */}
            {withdrawals.filter((w) => w.status !== 'pending').map((w) => {
              const isMyRequest = w.user_id === user?.id;
              const memberData = members.find((m) => m.user_id === w.user_id);
              const profile = (memberData as any)?.profiles;
              const requesterName = profile?.first_name || 'Member';
              const statusLabel = w.status === 'approved' ? 'Approved' : 'Rejected';
              const statusColor = w.status === 'approved' ? 'text-success bg-success/10 border-success/20' : 'text-destructive bg-destructive/10 border-destructive/20';

              return (
                <div key={w.id} className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-base">{w.status === 'approved' ? '✅' : '❌'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {isMyRequest ? 'Your withdrawal' : `${requesterName}'s withdrawal`} — {formatCurrency(w.amount, currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(w.processed_at || w.created_at)}</p>
                      {w.note && <p className="text-xs text-muted-foreground mt-0.5 italic">"{w.note}"</p>}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${statusColor}`}>
                      {statusLabel}
                    </span>
                  </div>
                </div>
              );
            })}

            <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                <span className="text-base">🎉</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Created "{pot.name}"</p>
                <p className="text-xs text-muted-foreground">{formatDate(pot.created_at)}</p>
              </div>
            </div>

            {transactions.map((tx) => {
              const receipt = receiptByTx[tx.id];
              const myTx = tx.user_id === user?.id;
              const isWithdrawal = Number(tx.amount) < 0;
              const needsReceipt = !receipt && myTx && !isWithdrawal && pot.require_receipt;
              const needsWithdrawalReceipt = isWithdrawal && !receipt && myTx;

              return (
                <div key={tx.id} className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-base">{isWithdrawal ? '💸' : '💳'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {isWithdrawal ? 'Withdrawal' : 'Added'} {formatCurrency(Math.abs(Number(tx.amount)), currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
                      {receipt && (
                        <div className="mt-1.5">
                          {receipt.image_url ? (
                            <a
                              href={receipt.image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] inline-flex items-center gap-1 text-primary font-semibold bg-accent border border-primary/20 px-2 py-0.5 rounded-full hover:bg-primary/10 transition-colors"
                            >
                              <ImageIcon size={9} />
                              View receipt
                            </a>
                          ) : (
                            <ReceiptStatusBadge status={receipt.status} />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`font-bold text-sm ${isWithdrawal ? 'text-destructive' : 'text-success'}`}>
                        {isWithdrawal ? '' : '+'}{formatCurrency(Number(tx.amount), currency)}
                      </span>
                      {(needsReceipt || needsWithdrawalReceipt) && (
                        <button
                          onClick={() => setShowUpload(tx.id)}
                          className="text-[10px] flex items-center gap-1 text-warning font-semibold bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full hover:bg-warning/20 transition-colors"
                        >
                          <Upload size={9} />
                          Upload receipt
                        </button>
                      )}
                      {receipt && receipt.status === 'submitted' && isCreator && (
                        <button
                          onClick={() => setShowReview(receipt)}
                          className="text-[10px] flex items-center gap-1 text-primary font-semibold bg-accent border border-primary/20 px-2 py-0.5 rounded-full hover:bg-primary/10 transition-colors"
                        >
                          <ImageIcon size={9} />
                          Review
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {transactions.length === 0 && (
              <div className="bg-card rounded-xl border border-border p-10 text-center">
                <p className="text-sm text-muted-foreground">No transactions yet. Add funds to get started! 💰</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-5 space-y-3">
            {(() => {
              // Build leaderboard from transactions (positive amounts = deposits)
              const depositsByUser: Record<string, number> = {};
              transactions.forEach((tx) => {
                const amt = Number(tx.amount);
                if (amt > 0) {
                  depositsByUser[tx.user_id] = (depositsByUser[tx.user_id] || 0) + amt;
                }
              });

              // Also include members with 0 contributions
              members.forEach((m) => {
                if (!(m.user_id in depositsByUser)) {
                  depositsByUser[m.user_id] = 0;
                }
              });

              const ranked = Object.entries(depositsByUser)
                .sort((a, b) => b[1] - a[1])
                .map(([userId, total], index) => {
                  const member = members.find((m) => m.user_id === userId);
                  const profile = (member as any)?.profiles;
                  return { userId, total, rank: index + 1, profile, member };
                });

              const trophies: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

              if (ranked.length === 0) {
                return (
                  <div className="bg-card rounded-xl border border-border p-10 text-center">
                    <p className="text-sm text-muted-foreground">No contributions yet. Add funds to get started! 💰</p>
                  </div>
                );
              }

              return ranked.map(({ userId, total, rank, profile }) => {
                const name = profile?.first_name || 'Member';
                const avatarUrl = profile?.avatar_url;
                const avatarColor = profile?.avatar_color || '#3b82f6';
                const initial = name[0]?.toUpperCase() || '?';
                const trophy = trophies[rank] || '';

                return (
                  <div key={userId} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
                    <div className="w-8 text-center font-bold text-lg flex-shrink-0">
                      {trophy || <span className="text-muted-foreground text-sm">#{rank}</span>}
                    </div>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                      style={{ backgroundColor: avatarUrl ? undefined : avatarColor }}
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-sm">{initial}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {userId === user?.id ? `${name} (You)` : name}
                      </p>
                    </div>
                    <span className="font-bold text-sm text-success flex-shrink-0">
                      {formatCurrency(total, currency)}
                    </span>
                  </div>
                );
              });
            })()}
          </TabsContent>

          <TabsContent value="members" className="mt-5 space-y-3">
            {members.map((m) => {
              const memberProfile = (m as any).profiles;
              const memberName = memberProfile?.first_name || 'Member';
              const memberAvatar = memberProfile?.avatar_url;
              const memberColor = memberProfile?.avatar_color || '#3b82f6';
              const initial = memberName[0]?.toUpperCase() || '?';

              return (
                <div key={m.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
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
                      {m.user_id === user?.id ? `${memberName} (You)` : memberName}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                  </div>
                  {m.role === 'creator' && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-primary border border-primary/20 font-semibold">
                      👑 Creator
                    </span>
                  )}
                </div>
              );
            })}
          </TabsContent>
        </Tabs>

        {/* Bottom action buttons */}
        <div className="pt-4">
          {isCreator ? (
            <Button
              variant="destructive"
              className="w-full h-12 rounded-xl font-semibold text-base"
              onClick={() => setShowCloseDialog(true)}
            >
              <X size={16} className="mr-2" />
              Close Pot
            </Button>
          ) : (
            <Button
              variant="destructive"
              className="w-full h-12 rounded-xl font-semibold text-base"
              onClick={() => setShowLeaveDialog(true)}
            >
              <LogOut size={16} className="mr-2" />
              Leave Pot
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
              <h3 className="text-base font-bold text-foreground">Invite to {pot.name}</h3>
              <p className="text-xs text-muted-foreground">Anyone with this link can join your pot</p>
            </div>
            <Button
              className="w-full h-11 rounded-xl font-semibold"
              onClick={handleCopyLink}
            >
              {copied ? (
                <><Check size={16} className="mr-1.5" /> Copied!</>
              ) : (
                <><Copy size={16} className="mr-1.5" /> Copy Invite Link</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Pot Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this pot?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be removed from "{pot.name}" and won't be able to see it anymore. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
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
          members={members}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
}
