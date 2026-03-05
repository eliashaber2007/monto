import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface WithdrawalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  potId: string;
  potBalance: number;
  currency: string;
  withdrawalRule: string;
  withdrawalPassword?: string | null;
  potName: string;
  createdBy: string;
  maxWithdrawalAmount?: number | null;
  maxWithdrawalsPerDay?: number | null;
}

export default function WithdrawalModal({
  open,
  onOpenChange,
  potId,
  potBalance,
  currency,
  withdrawalRule,
  withdrawalPassword,
  potName,
  createdBy,
  maxWithdrawalAmount,
  maxWithdrawalsPerDay,
}: WithdrawalModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(val);

  const reset = () => {
    setAmount('');
    setNote('');
    setPassword('');
    setPasswordError('');
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    if (!user) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }
    if (numAmount > potBalance) {
      toast({ title: 'Amount exceeds pot balance', variant: 'destructive' });
      return;
    }
    if (maxWithdrawalAmount && numAmount > maxWithdrawalAmount) {
      toast({ title: `Maximum withdrawal is ${formatCurrency(maxWithdrawalAmount)}`, variant: 'destructive' });
      return;
    }

    // Check daily withdrawal limit
    if (maxWithdrawalsPerDay) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('withdrawals')
        .select('id', { count: 'exact', head: true })
        .eq('pot_id', potId)
        .eq('user_id', user.id)
        .gte('created_at', todayStart.toISOString());
      if ((count ?? 0) >= maxWithdrawalsPerDay) {
        toast({ title: `You've reached the daily limit of ${maxWithdrawalsPerDay} withdrawals`, variant: 'destructive' });
        return;
      }
    }

    // Check Stripe onboarding
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_onboarding_complete')
      .eq('id', user.id)
      .single();

    if (!(profile as any)?.stripe_onboarding_complete) {
      toast({
        title: 'Bank account required',
        description: 'Please connect your bank account in your Profile before withdrawing.',
        variant: 'destructive',
      });
      return;
    }

    // Password check
    if (withdrawalRule === 'requires_password') {
      if (password !== withdrawalPassword) {
        setPasswordError('Incorrect withdrawal password');
        return;
      }
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      // Creator requesting from a requires_approval pot → auto-approve
      const isCreator = user.id === createdBy;
      const shouldAutoPayout =
        withdrawalRule === 'auto_approve' ||
        withdrawalRule === 'requires_password' ||
        (withdrawalRule === 'requires_approval' && isCreator);

      if (shouldAutoPayout) {
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
              pot_id: potId,
              amount: numAmount,
              currency: currency.toLowerCase(),
              recipient_user_id: user.id,
            }),
          }
        );

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Payout failed');

        toast({
          title: `Withdrawal of ${formatCurrency(numAmount)} is being processed`,
        });
      } else {
        // requires_approval for non-creator — insert a pending withdrawal record only (no balance deduction)
        const { error: wErr } = await supabase.from('withdrawals').insert({
          pot_id: potId,
          user_id: user.id,
          amount: numAmount,
          note: note.trim(),
          status: 'pending',
        });
        if (wErr) throw wErr;

        toast({
          title: 'Withdrawal request sent to the pot creator',
        });
      }

      queryClient.invalidateQueries({ queryKey: ['pot', potId] });
      queryClient.invalidateQueries({ queryKey: ['pots'] });
      handleClose(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[360px] rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-center">Request Withdrawal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label htmlFor="withdrawal-amount" className="text-sm font-medium">
              Amount to withdraw
            </Label>
            <Input
              id="withdrawal-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={potBalance}
              placeholder={`Max ${formatCurrency(potBalance)}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Available: {formatCurrency(potBalance)}
            </p>
          </div>

          <div>
            <Label htmlFor="withdrawal-note" className="text-sm font-medium">
              Reason for withdrawal <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="withdrawal-note"
              placeholder="Reason for withdrawal..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 resize-none"
            />
            {!note.trim() && amount && (
              <p className="text-xs text-destructive mt-1">A reason is required</p>
            )}
          </div>

          {withdrawalRule === 'requires_password' && (
            <div>
              <Label htmlFor="withdrawal-password" className="text-sm font-medium">
                Withdrawal password
              </Label>
              <Input
                id="withdrawal-password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError('');
                }}
                className="mt-1"
              />
              {passwordError && (
                <p className="text-xs text-destructive mt-1">{passwordError}</p>
              )}
            </div>
          )}

          {withdrawalRule === 'requires_approval' && (
            <p className="text-xs text-muted-foreground bg-secondary rounded-lg p-3">
              This pot requires creator approval. Your request will be sent for review.
            </p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={loading || !amount || !note.trim()}
            className="w-full h-11 rounded-xl font-semibold"
          >
            {loading ? 'Processing…' : 'Confirm Withdrawal'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

