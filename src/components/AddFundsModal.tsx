import { useState } from 'react';
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
import { CreditCard, Building2, Wallet } from 'lucide-react';

const QUICK_AMOUNTS = [10, 25, 50, 100];

type PaymentMethod = 'card' | 'revolut_pay' | 'sepa';

function calcFee(amount: number, method: PaymentMethod) {
  if (method === 'sepa') {
    return parseFloat(((amount * 0.005) + 0.35).toFixed(2));
  }
  if (method === 'revolut_pay') {
    return parseFloat(((amount * 0.012) + 0.15).toFixed(2));
  }
  return parseFloat(((amount * 0.02) + 0.25).toFixed(2));
}

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('revolut_pay');
  const { toast } = useToast();

  const amount = selected ?? (custom ? parseFloat(custom) : null);
  const showSepa = amount != null && amount >= 200;

  // If SEPA was selected but amount dropped below 200, reset to revolut_pay
  const effectiveMethod = paymentMethod === 'sepa' && !showSepa ? 'revolut_pay' : paymentMethod;

  const handleConfirm = async () => {
    if (!amount || amount <= 0) {
      toast({ title: t('addFunds.invalidAmount'), description: t('addFunds.invalidAmountDesc'), variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const res = await supabase.functions.invoke('create-checkout-session', {
        body: {
          pot_id: potId,
          base_amount_cents: Math.round(amount * 100),
          payment_method: effectiveMethod,
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

  const fmt = (v: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(v);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
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

          {/* Payment method selector */}
          <div className="space-y-2">
            <Label>{t('addFunds.paymentMethod')}</Label>
            <div className={`grid gap-2 ${showSepa ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition-all ${
                  effectiveMethod === 'card'
                    ? 'border-primary ring-1 ring-primary bg-card'
                    : 'bg-card border-border hover:border-primary/40'
                }`}
              >
                <CreditCard className="h-5 w-5 text-foreground" />
                <span className="text-sm font-semibold text-foreground">{t('addFunds.card')}</span>
                <span className="text-xs text-muted-foreground text-center">{t('addFunds.cardSubtitle')}</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('revolut_pay')}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition-all ${
                  effectiveMethod === 'revolut_pay'
                    ? 'border-primary ring-1 ring-primary bg-card'
                    : 'bg-card border-border hover:border-primary/40'
                }`}
              >
                <Wallet className="h-5 w-5 text-foreground" />
                <span className="text-sm font-semibold text-foreground">{t('addFunds.revolut')}</span>
                <span className="text-xs text-muted-foreground text-center">{t('addFunds.revolutSubtitle')}</span>
              </button>
              {showSepa && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('sepa')}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition-all ${
                    effectiveMethod === 'sepa'
                      ? 'border-primary ring-1 ring-primary bg-card'
                      : 'bg-card border-border hover:border-primary/40'
                  }`}
                >
                  <Building2 className="h-5 w-5 text-foreground" />
                  <span className="text-sm font-semibold text-foreground">{t('addFunds.sepa')}</span>
                  <span className="text-xs text-muted-foreground text-center">{t('addFunds.sepaSubtitle')}</span>
                </button>
              )}
            </div>
          </div>

          {amount && amount > 0 && (() => {
            const fee = calcFee(amount, effectiveMethod);
            const totalCharged = parseFloat((amount + fee).toFixed(2));
            const feeKey = effectiveMethod === 'sepa' ? 'addFunds.sepaFee' : effectiveMethod === 'revolut_pay' ? 'addFunds.revolutFee' : 'addFunds.processingFee';
            return (
              <div className="space-y-1">
                <div className="text-sm text-foreground font-semibold">
                  {t('addFunds.addedToPot', { amount: fmt(amount) })}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('addFunds.totalCharged', { total: fmt(totalCharged) })}
                </div>
                <div className="text-xs text-muted-foreground/70">
                  {t(feeKey, { fee: fmt(fee) })}
                </div>
              </div>
            );
          })()}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirm}
              disabled={loading || !amount || amount <= 0}
            >
              {loading ? t('addFunds.redirecting') : t('addFunds.payWithStripe')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
