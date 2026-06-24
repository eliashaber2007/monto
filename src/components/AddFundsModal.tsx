import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
  // Single source of truth: the raw string the user is typing
  const [rawInput, setRawInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setRawInput('');
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

  const amount = rawInput ? parseFloat(rawInput) : null;
  const showSepa = amount != null && amount > 0;

  const fmt = useMemo(
    () => (v: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(v),
    [currency]
  );

  const total = useMemo(() => {
    if (!amount || amount <= 0 || !paymentMethod) return amount ?? 0;
    return parseFloat((amount + calcFee(amount, paymentMethod)).toFixed(2));
  }, [amount, paymentMethod]);

  const handleRawChange = (val: string) => {
    // Allow empty, integers, or decimals with up to 2 decimal places
    if (val === '' || /^\d+(\.\d{0,2})?$/.test(val)) {
      setRawInput(val);
    }
  };

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
          {/* Hero amount — the input IS the big display */}
          <div className="flex items-center justify-center gap-1 py-3">
            <span className="text-5xl font-bold text-foreground select-none">€</span>
            <input
              type="text"
              inputMode="decimal"
              value={rawInput}
              onChange={(e) => handleRawChange(e.target.value)}
              placeholder="0"
              className="text-5xl font-bold text-foreground bg-transparent border-none outline-none focus:outline-none ring-0 focus:ring-0 w-36 text-left tabular-nums p-0 placeholder:text-foreground/30 caret-primary"
            />
          </div>

          {/* Quick-amount chips */}
          <div className="flex gap-2 justify-center flex-wrap">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => setRawInput(String(a))}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                  rawInput === String(a)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-muted-foreground border-border hover:border-primary/40'
                }`}
              >
                €{a}
              </button>
            ))}
          </div>

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
