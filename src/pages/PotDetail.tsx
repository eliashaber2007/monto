import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePotDetail } from '@/hooks/usePots';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AddFundsModal from '@/components/AddFundsModal';

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatRelative(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ProgressRing({ balance }: { balance: number }) {
  const radius = 90;
  const stroke = 10;
  const normalised = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalised;

  return (
    <div className="relative flex items-center justify-center w-52 h-52 mx-auto">
      <svg className="absolute" width={208} height={208} viewBox="0 0 208 208">
        {/* Background track */}
        <circle
          cx={104}
          cy={104}
          r={normalised}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx={104}
          cy={104}
          r={normalised}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.8}
          transform="rotate(-90 104 104)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      {/* Center content */}
      <div className="text-center z-10">
        <div className="text-3xl font-bold text-foreground">{formatCurrency(balance, 'EUR')}</div>
        <div className="text-xs text-muted-foreground mt-1">balance</div>
      </div>
    </div>
  );
}

export default function PotDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, refetch } = usePotDetail(id);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const queryClient = useQueryClient();

  // Show success banner if redirected from Stripe
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setShowSuccess(true);
      const t = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  // Realtime balance updates
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`pot-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pots', filter: `id=eq.${id}` }, () => {
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, refetch]);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { pot, members, transactions, myRole } = data;

  return (
    <div className="min-h-screen bg-surface">
      {/* Success banner */}
      {showSuccess && (
        <div className="bg-success text-success-foreground text-sm text-center py-3 px-4 font-medium animate-fade-in">
          🎉 Payment successful! Your balance will update shortly.
        </div>
      )}

      {/* Top bar */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-foreground truncate">{pot.name}</h1>
              <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                {myRole === 'creator' ? 'Creator' : 'Member'}
              </span>
            </div>
          </div>
          <button className="flex items-center gap-1.5 text-xs text-primary font-medium border border-primary/30 rounded-full px-3 py-1.5 hover:bg-primary/5 transition-colors">
            <Users size={13} />
            Invite
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Ring + balance */}
        <div className="bg-card rounded-2xl shadow-card border border-border p-6 text-center">
          <ProgressRing balance={pot.balance ?? 0} />
          <p className="text-sm text-muted-foreground mt-3">
            0% of {formatCurrency(0, pot.currency ?? 'EUR')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Tap to switch view</p>
        </div>

        {/* Action row */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12 font-semibold"
            disabled
          >
            Request Withdrawal
          </Button>
          <Button
            className="h-12 px-6 font-semibold"
            onClick={() => setShowAddFunds(true)}
          >
            + Add Funds
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="activity">
          <TabsList className="w-full bg-secondary rounded-xl p-1 h-11">
            <TabsTrigger value="activity" className="flex-1 rounded-lg text-sm">Activity</TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex-1 rounded-lg text-sm">Leaderboard</TabsTrigger>
            <TabsTrigger value="members" className="flex-1 rounded-lg text-sm">Members</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="mt-4 space-y-3">
            {/* Pot creation event */}
            <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary text-xs">🎉</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Created pot "{pot.name}"</p>
                <p className="text-xs text-muted-foreground">{formatRelative(pot.created_at)}</p>
              </div>
            </div>

            {/* Completed transactions */}
            {transactions.map((tx) => (
              <div key={tx.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-success text-xs">💳</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Added {formatCurrency(tx.amount, pot.currency ?? 'EUR')}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatRelative(tx.created_at)}</p>
                </div>
                <span className="text-success font-semibold text-sm">
                  +{formatCurrency(tx.amount, pot.currency ?? 'EUR')}
                </span>
              </div>
            ))}

            {transactions.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">
                No transactions yet. Add funds to get started!
              </p>
            )}
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-4">
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <p className="text-muted-foreground text-sm">Leaderboard coming soon</p>
            </div>
          </TabsContent>

          <TabsContent value="members" className="mt-4 space-y-3">
            {members.map((m) => (
              <div key={m.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full border-2 border-border bg-surface" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {m.user_id === user?.id ? 'You' : `Member`}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                </div>
                {m.role === 'creator' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                    Creator
                  </span>
                )}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <AddFundsModal
        open={showAddFunds}
        onOpenChange={setShowAddFunds}
        potId={id!}
        potName={pot.name}
        currency={pot.currency ?? 'EUR'}
      />
    </div>
  );
}
