import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Receipt, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
    hour: '2-digit', minute: '2-digit',
  });
}

interface Expense {
  id: string;
  withdrawal_id: string;
  name: string;
  description: string | null;
  amount: number;
  receipt_url: string | null;
  created_at: string;
}

export default function WithdrawalExpenses() {
  const { withdrawalId } = useParams<{ withdrawalId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [withdrawal, setWithdrawal] = useState<any>(null);
  const [pot, setPot] = useState<any>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [expName, setExpName] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expFile, setExpFile] = useState<File | null>(null);
  const [expPreview, setExpPreview] = useState<string | null>(null);

  const isOwner = withdrawal?.user_id === user?.id;

  useEffect(() => {
    if (!withdrawalId) return;
    const load = async () => {
      setLoading(true);
      const { data: w } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('id', withdrawalId)
        .maybeSingle();
      setWithdrawal(w);

      if (w) {
        const { data: p } = await supabase
          .from('pots')
          .select('*')
          .eq('id', w.pot_id)
          .maybeSingle();
        setPot(p);
      }

      await fetchExpenses();
      setLoading(false);
    };
    load();
  }, [withdrawalId]);

  const fetchExpenses = async () => {
    if (!withdrawalId) return;
    const { data } = await supabase
      .from('withdrawal_expenses')
      .select('*')
      .eq('withdrawal_id', withdrawalId)
      .order('created_at', { ascending: true });
    setExpenses((data as Expense[]) ?? []);
  };

  const resetForm = () => {
    setExpName('');
    setExpDescription('');
    setExpAmount('');
    setExpFile(null);
    setExpPreview(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExpFile(file);
      setExpPreview(URL.createObjectURL(file));
    }
  };

  const handleAddExpense = async () => {
    if (!expName.trim() || !expAmount || Number(expAmount) <= 0) {
      toast({ title: 'Please fill in expense name and a valid amount', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      let receiptUrl: string | null = null;

      if (expFile) {
        const ext = expFile.name.split('.').pop();
        const path = `${withdrawalId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(path, expFile, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(path);
        receiptUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('withdrawal_expenses').insert({
        withdrawal_id: withdrawalId!,
        user_id: user!.id,
        name: expName.trim(),
        description: expDescription.trim() || null,
        amount: Number(expAmount),
        receipt_url: receiptUrl,
      });

      if (error) throw error;

      toast({ title: 'Expense added ✅' });
      resetForm();
      setShowAddForm(false);
      await fetchExpenses();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    const { error } = await supabase.from('withdrawal_expenses').delete().eq('id', expenseId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Expense removed' });
    await fetchExpenses();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!withdrawal || !pot) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">Withdrawal not found</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go back</Button>
      </div>
    );
  }

  const currency = pot.currency ?? 'EUR';
  const withdrawalAmount = Number(withdrawal.amount);
  const totalJustified = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="min-h-screen pb-28 bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-foreground text-lg">Expenses</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 pt-6 space-y-5">
        {/* Summary card */}
        <div className="bg-card rounded-xl border border-border p-5 text-center space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Justifying
          </p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(withdrawalAmount, currency)}
          </p>
          <div className="w-full max-w-[260px] mx-auto h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${Math.min((totalJustified / withdrawalAmount) * 100, 100)}%` }}
            />
          </div>
          <p className="text-sm font-semibold text-foreground">
            {formatCurrency(totalJustified, currency)} of {formatCurrency(withdrawalAmount, currency)} justified
          </p>
        </div>

        {/* Expenses list */}
        {expenses.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-10 text-center">
            <Receipt size={32} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No expenses added yet</p>
            {isOwner && (
              <p className="text-xs text-muted-foreground mt-1">Tap + below to justify your withdrawal</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {expenses.map((exp) => (
              <div key={exp.id} className="bg-card rounded-xl border border-border p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                    <Receipt size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{exp.name}</p>
                    {exp.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{exp.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(exp.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-bold text-foreground">
                      {formatCurrency(Number(exp.amount), currency)}
                    </span>
                    {isOwner && (
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="text-destructive/60 hover:text-destructive transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {exp.receipt_url && (
                  <div className="ml-12">
                    <a
                      href={exp.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] inline-flex items-center gap-1 text-primary font-semibold bg-accent border border-primary/20 px-2 py-0.5 rounded-full hover:bg-primary/10 transition-colors"
                    >
                      <Receipt size={9} />
                      View receipt
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add button - only for withdrawal owner */}
        {isOwner && (
          <div className="fixed bottom-6 right-6 z-30">
            <button
              onClick={() => setShowAddForm(true)}
              className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
            >
              <Plus size={24} />
            </button>
          </div>
        )}
      </div>

      {/* Add expense dialog */}
      <Dialog open={showAddForm} onOpenChange={(v) => { if (!v) { resetForm(); } setShowAddForm(v); }}>
        <DialogContent className="max-w-[340px] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Expense name *</Label>
              <Input
                placeholder="e.g. Restaurant dinner"
                value={expName}
                onChange={(e) => setExpName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Description (optional)</Label>
              <Textarea
                placeholder="e.g. Team dinner at Le Jules Verne"
                value={expDescription}
                onChange={(e) => setExpDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Amount *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Receipt (optional)</Label>
              {expPreview ? (
                <div className="relative">
                  <img src={expPreview} alt="Receipt preview" className="w-full max-h-40 object-contain rounded-lg border border-border" />
                  <button
                    onClick={() => { setExpFile(null); setExpPreview(null); }}
                    className="absolute top-1 right-1 w-6 h-6 bg-background/80 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 border border-dashed border-border rounded-lg p-3 cursor-pointer hover:bg-secondary/50 transition-colors">
                  <Upload size={16} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Upload photo or PDF</span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
                </label>
              )}
            </div>
            <Button
              className="w-full h-11 rounded-xl font-semibold"
              onClick={handleAddExpense}
              disabled={submitting}
            >
              {submitting ? 'Adding…' : 'Add Expense'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
