import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Users, Plus, CheckCircle2, XCircle, Clock, Image as ImageIcon, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePotDetail } from '@/hooks/usePots';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AddFundsModal from '@/components/AddFundsModal';
import ReceiptUploadModal from '@/components/ReceiptUploadModal';
import ReceiptReviewModal from '@/components/ReceiptReviewModal';

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

// Liquid Bubble progress ring for detail
function ProgressRing({ balance, goal }: { balance: number; goal?: number | null }) {
  const radius = 88;
  const stroke = 10;
  const norm = radius - stroke / 2;
  const circ = 2 * Math.PI * norm;
  const pct = goal && goal > 0 ? Math.min(balance / goal, 1) : 0;

  return (
    <div className="relative flex items-center justify-center w-52 h-52 mx-auto">
      <svg className="absolute" width={208} height={208} viewBox="0 0 208 208">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(221,83%,68%)" />
            <stop offset="100%" stopColor="hsl(221,83%,45%)" />
          </linearGradient>
        </defs>
        <circle cx={104} cy={104} r={norm} fill="none" stroke="hsl(214,32%,91%)" strokeWidth={stroke} />
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
      </svg>
      <div className="text-center z-10">
        <div className="text-3xl font-bold text-foreground">{formatCurrency(balance, 'EUR')}</div>
        <div className="text-xs text-muted-foreground mt-1">balance</div>
        {goal && goal > 0 && (
          <div className="text-xs text-primary font-medium mt-0.5">{Math.round(pct * 100)}% of goal</div>
        )}
      </div>
    </div>
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
  const [showUpload, setShowUpload] = useState<string | null>(null); // transactionId
  const [showReview, setShowReview] = useState<any | null>(null);   // receipt row
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      toast({
        title: '🎉 Payment successful!',
        description: 'Your balance will update shortly.',
      });
      // Refetch balance after a short delay to allow webhook to process
      setTimeout(() => refetch(), 3000);
      // Clean up the query param
      setSearchParams({}, { replace: true });
    } else if (payment === 'cancelled') {
      toast({
        title: 'Payment cancelled',
        description: 'No funds were added.',
        variant: 'destructive',
      });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  // Realtime balance
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`pot-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pots', filter: `id=eq.${id}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, refetch]);

  // Load receipts for this pot
  useEffect(() => {
    if (!id) return;
    supabase.from('receipts').select('*').eq('pot_id', id).order('created_at', { ascending: false })
      .then(({ data }) => setReceipts(data ?? []));
  }, [id]);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(220,20%,97%)' }}>
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { pot, members, transactions, myRole } = data;
  const isCreator = myRole === 'creator';

  // Map receipt by transaction id for quick lookup
  const receiptByTx: Record<string, any> = {};
  receipts.forEach(r => { if (r.transaction_id) receiptByTx[r.transaction_id] = r; });

  return (
    <div className="min-h-screen pb-24" style={{ background: 'hsl(220,20%,97%)' }}>
      {/* Top bar */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-foreground truncate">{pot.name}</h1>
              <span className="flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-accent text-primary border border-primary/20 font-semibold">
                {myRole === 'creator' ? 'Creator' : 'Member'}
              </span>
            </div>
          </div>
          <button className="flex items-center gap-1.5 text-xs text-primary font-semibold border border-primary/30 rounded-full px-3 py-1.5 hover:bg-accent transition-colors">
            <Users size={13} />
            Invite
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Ring + balance */}
        <div className="bg-card rounded-2xl shadow-card border border-border p-6 text-center">
          <ProgressRing balance={pot.balance ?? 0} goal={pot.goal_amount} />
          {pot.goal_amount ? (
            <p className="text-sm text-muted-foreground mt-3">
              {formatCurrency(pot.balance ?? 0, pot.currency ?? 'EUR')} of {formatCurrency(pot.goal_amount, pot.currency ?? 'EUR')} goal
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-3">No goal set</p>
          )}
          {pot.require_receipt && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-warning font-medium bg-warning/10 px-2.5 py-1 rounded-full border border-warning/20">
              <CheckCircle2 size={11} />
              Receipt verification enabled
            </div>
          )}
        </div>

        {/* Action row */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-12 rounded-xl font-semibold" disabled>
            Request Withdrawal
          </Button>
          <Button className="h-12 px-6 rounded-xl font-semibold" onClick={() => setShowAddFunds(true)}>
            <Plus size={16} className="mr-1" />
            Add Funds
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="activity">
          <TabsList className="w-full bg-secondary rounded-xl p-1 h-11">
            <TabsTrigger value="activity" className="flex-1 rounded-lg text-sm">Activity</TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex-1 rounded-lg text-sm">Leaderboard</TabsTrigger>
            <TabsTrigger value="members" className="flex-1 rounded-lg text-sm">Members</TabsTrigger>
          </TabsList>

          {/* ── Activity ── */}
          <TabsContent value="activity" className="mt-4 space-y-3">
            {/* Creation event */}
            <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                <span className="text-base">🎉</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Created "{pot.name}"</p>
                <p className="text-xs text-muted-foreground">{formatDate(pot.created_at)}</p>
              </div>
            </div>

            {/* Transactions */}
            {transactions.map((tx) => {
              const receipt = receiptByTx[tx.id];
              const myTx = tx.user_id === user?.id;
              const needsReceipt = pot.require_receipt && !receipt && myTx;

              return (
                <div key={tx.id} className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-base">💳</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        Added {formatCurrency(tx.amount, pot.currency ?? 'EUR')}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
                      {receipt && (
                        <div className="mt-1.5">
                          <ReceiptStatusBadge status={receipt.status} />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-success font-bold text-sm">+{formatCurrency(tx.amount, pot.currency ?? 'EUR')}</span>
                      {needsReceipt && (
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
              <div className="bg-card rounded-xl border border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">No transactions yet. Add funds to get started!</p>
              </div>
            )}
          </TabsContent>

          {/* ── Leaderboard ── */}
          <TabsContent value="leaderboard" className="mt-4">
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <p className="text-muted-foreground text-sm">Leaderboard coming soon</p>
            </div>
          </TabsContent>

          {/* ── Members ── */}
          <TabsContent value="members" className="mt-4 space-y-3">
            {members.map((m) => (
              <div key={m.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0 text-primary font-bold text-sm">
                  {m.user_id === user?.id ? 'You' : 'M'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {m.user_id === user?.id ? 'You' : 'Member'}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                </div>
                {m.role === 'creator' && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-primary border border-primary/20 font-semibold">
                    Creator
                  </span>
                )}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <AddFundsModal
        open={showAddFunds}
        onOpenChange={setShowAddFunds}
        potId={id!}
        potName={pot.name}
        currency={pot.currency ?? 'EUR'}
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
            supabase.from('receipts').select('*').eq('pot_id', id!).order('created_at', { ascending: false })
              .then(({ data }) => setReceipts(data ?? []));
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
            supabase.from('receipts').select('*').eq('pot_id', id!).order('created_at', { ascending: false })
              .then(({ data }) => setReceipts(data ?? []));
          }}
        />
      )}
    </div>
  );
}
