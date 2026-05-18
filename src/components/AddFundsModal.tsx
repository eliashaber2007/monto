import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import PaymentMethodList, { PaymentMethod } from '@/components/PaymentMethodList';

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

  // Reset selection whenever modal opens
  useEffect(() => {
    if (open) {
      setPaymentMethod(null);
      setLoading(false);
    }
  }, [open]);

  // Reset loading state if user returns from Stripe redirect without completing payment
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

  const handleConfirm = async () => {
    if (!amount || amount <= 0 || !paymentMethod) {
      toast({ title: t('addFunds.invalidAmount'), description: t('addFunds.invalidAmountDesc'), variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const res = await supabase.functions.invoke('create-checkout-session', {
        body: {
          pot_id: potId,
          base_amount_cents: Math.round(amount * 100),
          payment_method: paymentMethod,
        },
      });

      if (res.error) throw res.error;

      const { url } = res.data as { url: string };
      if (url) {
        window.location.href = url;
      }
    } catch (err: any) {
      setLoading(false);
      toast({ title: t('common.error'), description: err.message ?? 'Could not start checkout.', variant: 'destructive' });
    }
  };

  const methodLabel = (m: PaymentMethod) =>
    m === 'card' ? t('addFunds.card') : m === 'revolut_pay' ? t('addFunds.revolut') : t('addFunds.sepa');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0" style={{ outline: 'none', boxShadow: 'none' }}>
        <DialogHeader>
          <DialogTitle>{t('addFunds.title', { name: potName })}</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-5">
          <div>
            <Label className="mb-2 block">{t('addFunds.chooseAmount')}</Label>
            <div className="grid grid-cols-4 gap-2">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => { setSelected(a); setCustom(''); }}
                  className={`h-10 rounded-xl text-sm font-semibold border transition-all ${
                    selected === a
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-foreground border-border hover:border-primary/40'
                  }`}
                >
                  €{a}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="customAmount">{t('addFunds.customAmount')}</Label>
            <Input
              id="customAmount"
              type="number"
              min="1"
              step="0.01"
              placeholder="e.g. 75.00"
              value={custom}
              onChange={(e) => { setCustom(e.target.value); setSelected(null); }}
              className="h-11"
            />
          </div>

          {amount != null && amount > 0 && (
            <div className="space-y-2">
              <Label>{t('addFunds.paymentMethod')}</Label>
              <PaymentMethodList
                amount={amount}
                currency={currency}
                selected={paymentMethod}
                onSelect={setPaymentMethod}
                showSepa={showSepa}
              />
            </div>
          )}

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
                : paymentMethod
                  ? `${t('paymentMethods.payWith', { method: methodLabel(paymentMethod), defaultValue: 'Pay with {{method}}' })} 🎉`
                  : t('addFunds.payWithStripe')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
