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
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const amount = selected ?? (custom ? parseFloat(custom) : null);

  const handleConfirm = async () => {
    if (!amount || amount <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter an amount greater than 0.', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await supabase.functions.invoke('create-checkout-session', {
        body: { pot_id: potId, amount_cents: Math.round(amount * 100) },
      });

      if (res.error) throw res.error;

      const { url } = res.data as { url: string };
      if (url) {
        window.location.href = url;
      }
    } catch (err: any) {
      setLoading(false);
      toast({ title: 'Error', description: err.message ?? 'Could not start checkout.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add Funds to "{potName}"</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-5">
          {/* Quick amounts */}
          <div>
            <Label className="mb-2 block">Choose amount</Label>
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

          {/* Custom amount */}
          <div className="space-y-1.5">
            <Label htmlFor="customAmount">Or enter custom amount (€)</Label>
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

          {/* Summary */}
          {amount && amount > 0 && (
            <div className="bg-surface rounded-xl p-3 flex justify-between text-sm">
              <span className="text-muted-foreground">You'll add</span>
              <span className="font-bold text-primary">
                {new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(amount)}
              </span>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirm}
              disabled={loading || !amount || amount <= 0}
            >
              {loading ? 'Redirecting…' : 'Pay with Stripe'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
