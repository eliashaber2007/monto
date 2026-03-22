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
  restricted,
}: AddFundsModalProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const amount = selected ?? (custom ? parseFloat(custom) : null);

  const handleConfirm = async () => {
    if (!amount || amount <= 0) {
      toast({ title: t('addFunds.invalidAmount'), description: t('addFunds.invalidAmountDesc'), variant: 'destructive' });
      return;
    }

    setLoading(true);

    const fee = parseFloat(((amount * 0.015) + 0.25).toFixed(2));
    const totalCharged = parseFloat((amount + fee).toFixed(2));

    try {
      const res = await supabase.functions.invoke('create-checkout-session', {
        body: { pot_id: potId, amount_cents: Math.round(totalCharged * 100), base_amount_cents: Math.round(amount * 100) },
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

  if (restricted) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t('addFunds.restricted')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">{t('addFunds.restrictedDesc')}</p>
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
        </DialogContent>
      </Dialog>
    );
  }

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

          {amount && amount > 0 && (() => {
            const fee = parseFloat(((amount * 0.015) + 0.25).toFixed(2));
            const totalCharged = parseFloat((amount + fee).toFixed(2));
            const fmt = (v: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(v);
            return (
              <div className="space-y-1">
                <div className="text-sm text-foreground font-semibold">
                  {t('addFunds.addedToPot', { amount: fmt(amount) })}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('addFunds.totalCharged', { total: fmt(totalCharged) })}
                </div>
                <div className="text-xs text-muted-foreground/70">
                  {t('addFunds.processingFee', { fee: fmt(fee) })}
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
