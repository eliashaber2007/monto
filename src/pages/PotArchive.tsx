import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePots } from '@/hooks/usePots';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

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
  });
}

export default function PotArchive() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: pots, isLoading } = usePots();
  const [expandedPot, setExpandedPot] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Record<string, any[]>>({});
  const [loadingTx, setLoadingTx] = useState<string | null>(null);

  const closedPots = (pots ?? []).filter((p: any) => p.status === 'closed');

  const handleExpand = async (potId: string, isCreator: boolean) => {
    if (expandedPot === potId) {
      setExpandedPot(null);
      return;
    }
    setExpandedPot(potId);

    if (transactions[potId]) return;

    setLoadingTx(potId);
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('pot_id', potId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!isCreator) {
      query = query.eq('user_id', user!.id);
    }

    const { data } = await query;
    setTransactions((prev) => ({ ...prev, [potId]: data ?? [] }));
    setLoadingTx(null);
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
          <h1 className="font-bold text-foreground text-lg">Pot Archive 📦</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-8 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : closedPots.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center shadow-sm">
            <span className="text-4xl block mb-3">📦</span>
            <h2 className="font-bold text-foreground text-lg mb-2">No closed pots</h2>
            <p className="text-sm text-muted-foreground">
              When pots are closed, they'll appear here for your records.
            </p>
          </div>
        ) : (
          closedPots.map((pot: any) => {
            const isCreator = pot.role === 'creator';
            const isExpanded = expandedPot === pot.id;
            const txList = transactions[pot.id] ?? [];

            return (
              <div key={pot.id} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <button
                  onClick={() => handleExpand(pot.id, isCreator)}
                  className="w-full p-5 flex items-center gap-4 text-left hover:bg-secondary/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">🔒</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-foreground truncate">{pot.name}</span>
                      <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                        Closed
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Closed by creator • Final balance: {formatCurrency(pot.balance ?? 0, pot.currency ?? 'EUR')}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={18} className="text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown size={18} className="text-muted-foreground flex-shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-5 py-4 space-y-2">
                    <p className="text-xs text-muted-foreground font-semibold mb-2">
                      {isCreator ? 'All transactions' : 'Your contributions'}
                    </p>
                    {loadingTx === pot.id ? (
                      <div className="flex justify-center py-4">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : txList.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No transactions found</p>
                    ) : (
                      txList.map((tx: any) => (
                        <div key={tx.id} className="flex items-center gap-3 py-2">
                          <span className="text-sm">{Number(tx.amount) < 0 ? '💸' : '💳'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">
                              {Number(tx.amount) < 0 ? 'Withdrawal' : 'Deposit'}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{formatDate(tx.created_at)}</p>
                          </div>
                          <span className={`text-sm font-bold ${Number(tx.amount) < 0 ? 'text-destructive' : 'text-success'}`}>
                            {Number(tx.amount) < 0 ? '' : '+'}{formatCurrency(Number(tx.amount), pot.currency ?? 'EUR')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
