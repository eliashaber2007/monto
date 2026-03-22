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
import { useTranslation } from 'react-i18next';

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
  myRole?: string;
}

export default function WithdrawalModal({
  open, onOpenChange, potId, potBalance, currency, withdrawalRule, withdrawalPassword, potName, createdBy, maxWithdrawalAmount, maxWithdrawalsPerDay, myRole,
}: WithdrawalModalProps) {
  const { t } = useTranslation();
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

  const reset = () => { setAmount(''); setNote(''); setPassword(''); setPasswordError(''); };
  const handleClose = (v: boolean) => { if (!v) reset(); onOpenChange(v); };

  const handleSubmit = async () => {
    if (!user) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({ title: t('withdrawalModal.invalidAmount'), variant: 'destructive' });
      return;
    }
    const fee = parseFloat(((numAmount * 0.0025) + 0.25).toFixed(2));
    const totalDeducted = parseFloat((numAmount + fee).toFixed(2));
    if (totalDeducted > potBalance) {
      toast({ title: t('withdrawalModal.exceedsBalance'), variant: 'destructive' });
      return;
    }
    if (maxWithdrawalAmount && numAmount > maxWithdrawalAmount) {
      toast({ title: t('withdrawalModal.maxWithdrawal', { amount: formatCurrency(maxWithdrawalAmount) }), variant: 'destructive' });
      return;
    }

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
        toast({ title: t('withdrawalModal.dailyLimit', { count: maxWithdrawalsPerDay }), variant: 'destructive' });
        return;
      }
    }

    const { data: profile } = await supabase.from('profiles').select('stripe_onboarding_complete').eq('id', user.id).single();
    if (!(profile as any)?.stripe_onboarding_complete) {
      toast({ title: t('withdrawalModal.bankRequired'), description: t('withdrawalModal.bankRequiredDesc'), variant: 'destructive' });
      return;
    }

    if (withdrawalRule === 'requires_password') {
      if (password !== withdrawalPassword) {
        setPasswordError(t('withdrawalModal.incorrectPassword'));
        return;
      }
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const isCreator = user.id === createdBy;

      // Auto-payout for: auto_approve (no security), requires_password (password already validated above),
      // or creator on requires_approval pots
      // Leaders must NOT self-approve on requires_approval pots
      const shouldAutoPayout = withdrawalRule === 'auto_approve' || withdrawalRule === 'requires_password' || (withdrawalRule === 'requires_approval' && isCreator);

      console.log('[Withdrawal] Rule:', withdrawalRule, 'isCreator:', isCreator, 'shouldAutoPayout:', shouldAutoPayout, 'amount:', numAmount);

      if (shouldAutoPayout) {
        console.log('[Withdrawal] Auto-payout: inserting withdrawal record first');
        const { data: wData, error: wErr } = await supabase.from('withdrawals').insert({ pot_id: potId, user_id: user.id, amount: numAmount, note: note.trim(), status: 'pending' }).select('id').single();
        if (wErr) throw wErr;
        const withdrawalId = (wData as any).id;

        console.log('[Withdrawal] Auto-payout: calling create-payout edge function');
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payout`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
            body: JSON.stringify({ pot_id: potId, amount: numAmount, currency: currency.toLowerCase(), recipient_user_id: user.id, withdrawal_id: withdrawalId }),
          }
        );
        const result = await response.json();
        console.log('[Withdrawal] Auto-payout response:', result);
        if (!response.ok) throw new Error(result.error || 'Payout failed');

        toast({ title: t('withdrawalModal.withdrawalApproved') });
      } else {
        // requires_approval and user is NOT creator — insert pending
        console.log('[Withdrawal] Pending approval: inserting pending withdrawal');
        const { error: wErr } = await supabase.from('withdrawals').insert({ pot_id: potId, user_id: user.id, amount: numAmount, note: note.trim(), status: 'pending' });
        if (wErr) throw wErr;

        try {
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-notification`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
              body: JSON.stringify({ type: 'withdrawal_requested', pot_id: potId, user_id: user.id, amount: numAmount, currency }),
            }
          );
        } catch (emailErr) {
          console.error('[Withdrawal] Email notification failed:', emailErr);
        }

        toast({ title: t('withdrawalModal.requestSentApproval') });
      }

      queryClient.invalidateQueries({ queryKey: ['pot', potId] });
      queryClient.invalidateQueries({ queryKey: ['pots'] });
      handleClose(false);
    } catch (err: any) {
      console.error('[Withdrawal] Error:', err);
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[360px] rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-center">{t('withdrawalModal.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label htmlFor="withdrawal-amount" className="text-sm font-medium">{t('withdrawalModal.amountToWithdraw')}</Label>
            <Input id="withdrawal-amount" type="number" step="0.01" min="0.01" max={potBalance} placeholder={t('withdrawalModal.max', { amount: formatCurrency(potBalance) })} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">{t('withdrawalModal.available', { amount: formatCurrency(potBalance) })}</p>
            {(() => {
              const num = parseFloat(amount);
              if (!num || num <= 0) return null;
              const fee = parseFloat(((num * 0.0025) + 0.25).toFixed(2));
              const totalDeducted = parseFloat((num + fee).toFixed(2));
              return (
                <div className="space-y-1 mt-2">
                  <div className="text-sm text-foreground font-semibold">
                    {t('withdrawalModal.amountReceived', { amount: formatCurrency(num) })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('withdrawalModal.totalDeducted', { amount: formatCurrency(totalDeducted) })}
                  </div>
                  <div className="text-xs text-muted-foreground/70">
                    {t('withdrawalModal.payoutFee', { fee: formatCurrency(fee) })}
                  </div>
                </div>
              );
            })()}
          </div>

          <div>
            <Label htmlFor="withdrawal-note" className="text-sm font-medium">{t('withdrawalModal.reason')} <span className="text-destructive">*</span></Label>
            <Textarea id="withdrawal-note" placeholder={t('withdrawalModal.reasonPlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 resize-none" />
            {!note.trim() && amount && <p className="text-xs text-destructive mt-1">{t('withdrawalModal.reasonRequired')}</p>}
          </div>

          {withdrawalRule === 'requires_password' && (
            <div>
              <Label htmlFor="withdrawal-password" className="text-sm font-medium">{t('withdrawalModal.withdrawalPasswordLabel')}</Label>
              <Input id="withdrawal-password" type="password" placeholder={t('withdrawalModal.enterPassword')} value={password} onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }} className="mt-1" />
              {passwordError && <p className="text-xs text-destructive mt-1">{passwordError}</p>}
            </div>
          )}

          {withdrawalRule === 'requires_approval' && (
            <p className="text-xs rounded-lg p-3" style={{ color: '#FFFFFF', backgroundColor: 'hsl(var(--primary))' }}>{t('withdrawalModal.requiresApprovalInfo')}</p>
          )}

          <Button onClick={handleSubmit} disabled={loading || !amount || !note.trim()} className="w-full h-11 rounded-xl font-semibold">
            {loading ? t('withdrawalModal.processing') : t('withdrawalModal.confirmWithdrawal')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
