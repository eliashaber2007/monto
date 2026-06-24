import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import PaymentMethodList, { PaymentMethod, calcFee } from '@/components/PaymentMethodList';

const QUICK_AMOUNTS = [10, 25, 50, 100];

interface AddFundsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  potId: string;
  potName: string;
  currency: string;
}

export default function AddFundsModal({
  open,
  onOpenChange,
  potId,
  potName,
  currency,
}: AddFundsModalProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setSelected(null);
      setCustom('');
      setPaymentMethod(null);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const resetLoading = () => setLoading(false);
    const onVisibility = () => { if (document.visibilityState === 'visible') resetLoading(); };
    window.addEventListener('focus', resetLoading);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', resetLoading);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [open]);

  const amount = selected ?? (custom ? parseFloat(custom) : null);
  const showSepa = amount != null && amount > 0;

  const fmt = useMemo(
    () => (v: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(v),
    [currency]
  );

  const total = useMemo(() => {
    if (!amount || amount <= 0 || !paymentMethod) return amount ?? 0;
    return parseFloat((amount + calcFee(amount, paymentMethod)).toFixed(2));
  }, [amount, paymentMethod]);

  const handleConfirm = async () => {
    if (!amount || amount <= 0 || !paymentMethod) {
      toast({ title: t('addFunds.invalidAmount'), description: t('addFunds.invalidAmountDesc'), variant: 'destructive' });
      return;
    }
    const base_amount_cents = Math.round(amount * 100);
    if (base_amount_cents < 100) {
      toast({ title: 'Montant minimum', description: 'Le montant minimum est de €1.00', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await supabase.functions.invoke('create-checkout-session', {
        body: { pot_id: potId, base_amount_cents, payment_method: paymentMethod },
      });
      if (res.error) throw res.error;
      const { url } = res.data as { url: string };
      if (url) window.location.href = url;
    } catch (err: any) {
      setLoading(false);
      toast({ title: t('common.error'), description: err.message ?? 'Could not start checkout.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0" style={{ outline: 'none', boxShadow: 'none' }}>
        <DialogHeader>
          <DialogTitle className="truncate">{t('addFunds.title', { name: potName })}</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-5">
          {/* Hero amount display */}
          <div className="text-center py-3">
            <p className="text-5xl font-bold tracking-tight text-foreground tabular-nums">
              {amount != null && amount > 0 ? fmt(amount) : fmt(0)}
            </p>
          </div>

          {/* Quick-amount chips */}
          <div className="flex gap-2 justify-center flex-wrap">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => { setSelected(a); setCustom(''); }}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                  selected === a
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-muted-foreground border-border hover:border-primary/40'
                }`}
              >
                €{a}
              </button>
            ))}
          </div>

          {/* Custom amount input */}
          <Input
            id="customAmount"
            type="number"
            min="1"
            step="0.01"
            placeholder={t('addFunds.customAmount')}
            value={custom}
            onChange={(e) => { setCustom(e.target.value); setSelected(null); }}
            className="h-11 text-center"
          />

          {/* Payment method selection */}
          {amount != null && amount > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('addFunds.paymentMethod')}
              </p>
              <PaymentMethodList
                amount={amount}
                currency={currency}
                selected={paymentMethod}
                onSelect={setPaymentMethod}
                showSepa={showSepa}
              />
            </div>
          )}

          {/* Confirm / cancel */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirm}
              disabled={loading || !amount || amount <= 0 || !paymentMethod}
            >
              {loading
                ? t('addFunds.redirecting')
                : t('addFunds.confirmAdd', { amount: fmt(total) })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
