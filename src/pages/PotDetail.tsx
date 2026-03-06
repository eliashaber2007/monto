import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Users, Plus, CheckCircle2, Image as ImageIcon, Upload, X, LogOut, Copy, Check, Landmark, ThumbsUp, ThumbsDown, MessageCircle, KeyRound, ChevronDown } from 'lucide-react';
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
  const [fundsOpen, setFundsOpen] = useState(false);
  const [withdrawalsOpen, setWithdrawalsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const inviteLink = `https://monto.lovable.app/invite/${id}`;

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
      // Call create-payout to trigger bank transfer (balance deduction happens inside the edge function)
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

      // 3. Mark withdrawal as approved
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
      // No balance refund needed since balance was never deducted on request
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
              {(pot as any).emoji && <span className="text-lg flex-shrink-0">{(pot as any).emoji}</span>}
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
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-1.5 text-xs text-primary font-semibold border border-primary/30 rounded-full px-3 py-1.5 hover:bg-accent transition-colors"
            >
              <Users size={13} />
              Invite
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-8 space-y-6">
        {/* Ring + balance */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
          <ProgressRing balance={pot.balance ?? 0} peakBalance={((pot as any).peak_balance > 0 ? (pot as any).peak_balance : pot.balance) ?? 0} currency={currency} />
          {((pot as any).peak_balance <= 0 && pot.balance <= 0) && !pot.goal_amount && (
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
            {(() => {
              const deposits = transactions.filter((tx) => Number(tx.amount) > 0);
              const withdrawalTxs = transactions.filter((tx) => Number(tx.amount) < 0);
              const totalDeposits = deposits.reduce((s, tx) => s + Number(tx.amount), 0);
              const totalWithdrawals = withdrawals.reduce((s, w) => s + Number(w.amount), 0);

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
                        <span>Funds Added</span>
                        <span className="text-muted-foreground font-normal">·</span>
                        <span className="text-success">{formatCurrency(totalDeposits, currency)}</span>
                        <span className="text-muted-foreground font-normal">·</span>
                        <span className="text-muted-foreground font-normal text-xs">{deposits.length} transaction{deposits.length !== 1 ? 's' : ''}</span>
                      </div>
                      <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${fundsOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {fundsOpen && (
                      <div className="border-t border-border divide-y divide-border">
                        {deposits.length === 0 ? (
                          <div className="p-4 text-center text-xs text-muted-foreground">No contributions yet</div>
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
                        <span>Withdrawals</span>
                        <span className="text-muted-foreground font-normal">·</span>
                        <span className="text-destructive">{formatCurrency(totalWithdrawals, currency)}</span>
                        <span className="text-muted-foreground font-normal">·</span>
                        <span className="text-muted-foreground font-normal text-xs">{withdrawals.length} transaction{withdrawals.length !== 1 ? 's' : ''}</span>
                      </div>
                      <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${withdrawalsOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {withdrawalsOpen && (
                      <div className="border-t border-border divide-y divide-border">
                        {withdrawals.length === 0 ? (
                          <div className="p-4 text-center text-xs text-muted-foreground">No withdrawals yet</div>
                        ) : withdrawals.map((w) => {
                          const profile = getMemberProfile(w.user_id);
                          const name = profile?.first_name || 'Member';
                          const isMyRequest = w.user_id === user?.id;
                          const isPending = w.status === 'pending';
                          const statusLabel = isPending ? 'Pending' : w.status === 'approved' ? 'Approved' : 'Rejected';
                          const statusColor = isPending
                            ? 'text-warning bg-warning/10 border-warning/20'
                            : w.status === 'approved'
                              ? 'text-success bg-success/10 border-success/20'
                              : 'text-destructive bg-destructive/10 border-destructive/20';

                          // Find matching withdrawal transaction for receipt lookup
                          const matchingTx = withdrawalTxs.find((tx) => tx.user_id === w.user_id && Math.abs(Number(tx.amount)) === Number(w.amount));
                          const receipt = matchingTx ? receiptByTx[matchingTx.id] : null;
                          const canUploadReceipt = isMyRequest && !receipt && matchingTx;

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
                                  <span className="text-sm font-bold text-destructive">-{formatCurrency(Number(w.amount), currency)}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${statusColor}`}>
                                    {statusLabel}
                                  </span>
                                </div>
                              </div>

                              {/* Receipt actions */}
                              {receipt && receipt.image_url && (
                                <div className="ml-11">
                                  <a
                                    href={receipt.image_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] inline-flex items-center gap-1 text-primary font-semibold bg-accent border border-primary/20 px-2 py-0.5 rounded-full hover:bg-primary/10 transition-colors"
                                  >
                                    <ImageIcon size={9} />
                                    View receipt
                                  </a>
                                </div>
                              )}
                              {receipt && receipt.status === 'submitted' && isCreator && (
                                <div className="ml-11">
                                  <button
                                    onClick={() => setShowReview(receipt)}
                                    className="text-[10px] flex items-center gap-1 text-primary font-semibold bg-accent border border-primary/20 px-2 py-0.5 rounded-full hover:bg-primary/10 transition-colors"
                                  >
                                    <ImageIcon size={9} />
                                    Review receipt
                                  </button>
                                </div>
                              )}
                              {canUploadReceipt && (
                                <div className="ml-11">
                                  <button
                                    onClick={() => setShowUpload(matchingTx.id)}
                                    className="text-[10px] flex items-center gap-1 text-warning font-semibold bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full hover:bg-warning/20 transition-colors"
                                  >
                                    <Upload size={9} />
                                    Upload receipt
                                  </button>
                                </div>
                              )}

                              {/* Creator approve/reject for pending */}
                              {isPending && isCreator && !isMyRequest && (
                                <div className="flex gap-2 ml-11">
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
                      </div>
                    )}
                  </div>
                  {/* Created card */}
                  <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                      <span className="text-base">🎉</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Created "{pot.name}"</p>
                      <p className="text-xs text-muted-foreground">{formatDate(pot.created_at)}</p>
                    </div>
                  </div>
                </>
              );
            })()}
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
        <div className="pt-4 space-y-3">
          {isCreator && pot.withdrawal_rule === 'requires_password' && (
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl font-semibold text-sm"
              onClick={() => setShowChangePassword(true)}
            >
              <KeyRound size={15} className="mr-2" />
              Change Withdrawal Password
            </Button>
          )}

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
            <Button
              className="w-full h-11 rounded-xl font-semibold bg-[#25D366] hover:bg-[#1da851] text-white"
              onClick={() => {
                const message = `Hey! I've created a pot called "${pot.name}" on Monto. Join here: ${inviteLink}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 mr-1.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Share via WhatsApp
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
