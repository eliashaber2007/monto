import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

type WithdrawalRule = "auto_approve" | "requires_approval" | "requires_password";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreatePotModal({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const WITHDRAWAL_RULES: { id: WithdrawalRule; label: string; desc: string }[] = [
    { id: "auto_approve", label: t('createPot.autoApprove'), desc: t('createPot.autoApproveDesc') },
    { id: "requires_approval", label: t('createPot.requiresApproval'), desc: t('createPot.requiresApprovalDesc') },
    { id: "requires_password", label: t('createPot.requiresPassword'), desc: t('createPot.requiresPasswordDesc') },
  ];

  const [step, setStep] = useState(1);
  const [potName, setPotName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [goalAmount, setGoalAmount] = useState("");
  const [withdrawalRule, setWithdrawalRule] = useState<WithdrawalRule | "">("")
  const [withdrawalPassword, setWithdrawalPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [initialDeposit, setInitialDeposit] = useState("");
  const [createdPotId, setCreatedPotId] = useState<string | null>(null);
  const [requireReceipt, setRequireReceipt] = useState(false);
  const [maxWithdrawalAmount, setMaxWithdrawalAmount] = useState("");
  const [maxWithdrawalsPerDay, setMaxWithdrawalsPerDay] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  

  const POT_EMOJIS = [
    "💰", "🏖️", "🎉", "🎁", "✈️", "🏠", "🚗", "🎓", "💍", "🍕",
    "🏋️", "⚽", "🎮", "🎵", "📱", "👶", "🐶", "🌴", "🎄", "💊",
    "🍻", "☕", "📚", "🛍️", "🎬", "🏔️",
  ];

  const reset = () => {
    setStep(1); setPotName(""); setCurrency("EUR"); setGoalAmount(""); setWithdrawalRule(""); setWithdrawalPassword(""); setInitialDeposit(""); setRequireReceipt(false); setMaxWithdrawalAmount(""); setMaxWithdrawalsPerDay(""); setSelectedEmoji(null);
  };

  const handleClose = (val: boolean) => { if (!val) reset(); onOpenChange(val); };

  const buildPotConfig = () => ({
    id: crypto.randomUUID(), name: potName.trim(), currency, goal_amount: goalAmount ? parseFloat(goalAmount) : null, withdrawal_rule: withdrawalRule || 'auto_approve', withdrawal_password: withdrawalRule === "requires_password" ? withdrawalPassword : null, require_receipt: requireReceipt, max_withdrawal_amount: maxWithdrawalAmount ? parseFloat(maxWithdrawalAmount) : null, max_withdrawals_per_day: maxWithdrawalsPerDay ? parseInt(maxWithdrawalsPerDay) : null, emoji: selectedEmoji,
  });

  const redirectToCheckout = async (potConfig: ReturnType<typeof buildPotConfig>, amountEuros: number) => {
    localStorage.setItem('pendingPotData', JSON.stringify(potConfig));
    const res = await supabase.functions.invoke("create-checkout-session", {
      body: { pot_id: potConfig.id, amount_cents: Math.round(amountEuros * 100), is_new_pot: true, pot_config: { name: potConfig.name, currency: potConfig.currency, goal_amount: potConfig.goal_amount, withdrawal_rule: potConfig.withdrawal_rule, withdrawal_password: potConfig.withdrawal_password, require_receipt: potConfig.require_receipt, max_withdrawal_amount: potConfig.max_withdrawal_amount, max_withdrawals_per_day: potConfig.max_withdrawals_per_day, emoji: potConfig.emoji } },
    });
    if (res.error) throw res.error;
    const { url } = res.data as { url: string };
    if (url) window.location.href = url;
  };

  const handleCreate = async () => {
    if (!potName.trim()) {
      toast({ title: t('createPot.missingPotName'), description: t('createPot.missingPotNameDesc'), variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session) {
      setCreating(false);
      toast({ title: t('createPot.notSignedIn'), description: t('createPot.notSignedInDesc'), variant: "destructive" });
      return;
    }
    if (goalAmount && parseFloat(goalAmount) > 0) {
      try { await redirectToCheckout(buildPotConfig(), parseFloat(goalAmount)); } catch (err: any) {
        setCreating(false);
        toast({ title: t('createPot.checkoutError'), description: err.message, variant: "destructive" });
      }
      return;
    }
    const potConfig = buildPotConfig();
    setCreatedPotId(potConfig.id);
    localStorage.setItem('pendingPotData', JSON.stringify(potConfig));
    setStep(4);
    setCreating(false);
  };

  const handleInitialDeposit = async () => {
    const amount = parseFloat(initialDeposit);
    if (!amount || amount <= 0) {
      toast({ title: t('createPot.invalidAmount'), description: t('createPot.invalidAmountDesc'), variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const pendingData = JSON.parse(localStorage.getItem('pendingPotData') || '{}');
      await redirectToCheckout(pendingData, amount);
    } catch (err: any) {
      setCreating(false);
      toast({ title: t('createPot.checkoutError'), description: err.message, variant: "destructive" });
    }
  };

  const handleSkipDeposit = async () => {
    setCreating(true);
    const pendingRaw = localStorage.getItem('pendingPotData');
    if (!pendingRaw) { setCreating(false); toast({ title: t('common.error'), description: t('createPot.missingData'), variant: "destructive" }); return; }
    const potConfig = JSON.parse(pendingRaw);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) { setCreating(false); toast({ title: t('createPot.notSignedIn'), variant: "destructive" }); return; }

    const { error: potError } = await supabase.from("pots").insert({
      id: potConfig.id, name: potConfig.name, created_by: userId, visual_style: "progress_ring", currency: potConfig.currency, goal_amount: potConfig.goal_amount, withdrawal_rule: potConfig.withdrawal_rule, withdrawal_password: potConfig.withdrawal_password, require_receipt: potConfig.require_receipt, max_withdrawal_amount: potConfig.max_withdrawal_amount, max_withdrawals_per_day: potConfig.max_withdrawals_per_day, emoji: potConfig.emoji,
    } as any);

    if (potError) { setCreating(false); toast({ title: t('common.error'), description: potError.message, variant: "destructive" }); return; }

    await supabase.from("pot_members").insert({ pot_id: potConfig.id, user_id: userId, role: "creator" });
    localStorage.removeItem('pendingPotData');
    queryClient.invalidateQueries({ queryKey: ["pots"] });
    setCreating(false);
    reset();
    onOpenChange(false);
    toast({ title: t('createPot.potCreated'), description: t('createPot.potCreatedDesc', { name: potConfig.name }) });
    navigate(`/pots/${potConfig.id}`);
  };

  const currencySymbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  const totalSteps = 3;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden gap-0 max-h-[90vh] flex flex-col">
        <div className="h-1 bg-muted flex-shrink-0">
          <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${(Math.min(step, totalSteps) / totalSteps) * 100}%` }} />
        </div>

        <div className="p-6 overflow-y-auto">
          <DialogHeader className="mb-5">
            <div className="flex items-center gap-2">
              {step > 1 && step <= 4 && (
                <button onClick={() => setStep((s) => s - 1)} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors -ml-1" type="button">
                  <ChevronLeft size={16} />
                </button>
              )}
              <DialogTitle className="text-base">
                {step === 1 && t('createPot.setupPot')}
                {step === 2 && t('createPot.withdrawalRules')}
                {step === 3 && t('createPot.receiptVerification')}
                {step === 4 && t('createPot.initialDeposit')}
              </DialogTitle>
              {step <= 3 && <span className="ml-auto text-xs text-muted-foreground font-medium">{step}/{totalSteps}</span>}
            </div>
          </DialogHeader>

          {/* Step 1: Pot basics */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="potName">{t('createPot.potName')}</Label>
                <Input id="potName" placeholder={t('createPot.potNamePlaceholder')} value={potName} onChange={(e) => setPotName(e.target.value)} autoFocus className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('createPot.currency')}</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR — Euro (€)</SelectItem>
                    <SelectItem value="GBP">GBP — British Pound (£)</SelectItem>
                    <SelectItem value="USD">USD — US Dollar ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goalAmount">{t('createPot.potAmount')}</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm select-none">{currencySymbol}</span>
                  <Input id="goalAmount" type="number" min="0" step="0.01" placeholder="e.g. 1000" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} className="h-11 pl-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t('createPot.addIcon')}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {POT_EMOJIS.map((emoji) => (
                    <button key={emoji} type="button" onClick={() => setSelectedEmoji(selectedEmoji === emoji ? null : emoji)} className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${selectedEmoji === emoji ? "bg-primary/15 ring-2 ring-primary scale-110" : "bg-secondary hover:bg-accent"}`}>{emoji}</button>
                  ))}
                </div>
              </div>
              <Button className="w-full h-11 rounded-xl" disabled={!potName.trim() || !goalAmount || parseFloat(goalAmount) <= 0} onClick={() => setStep(2)}>{t('common.next')}</Button>
            </div>
          )}

          {/* Step 2: Withdrawal rules & limits */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                {WITHDRAWAL_RULES.map(({ id, label, desc }) => (
                  <button key={id} type="button" onClick={() => setWithdrawalRule(id)} className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${withdrawalRule === id ? "border-primary bg-accent shadow-sm" : "border-border bg-card hover:border-primary/40"}`}>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{label}</div>
                      <div className="text-xs text-muted-foreground">{desc}</div>
                    </div>
                    {withdrawalRule === id && (<div className="ml-auto w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0"><div className="w-2 h-2 rounded-full bg-white" /></div>)}
                  </button>
                ))}
              </div>

              {withdrawalRule === "requires_password" && (
                <div className="space-y-1.5">
                  <Label htmlFor="wdPw">{t('createPot.withdrawalPassword')}</Label>
                  <Input id="wdPw" type="password" placeholder={t('createPot.withdrawalPasswordPlaceholder')} value={withdrawalPassword} onChange={(e) => setWithdrawalPassword(e.target.value)} className="h-11" />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="maxWdAmount">{t('createPot.maxWithdrawalAmount')}</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm select-none">{currencySymbol}</span>
                  <Input id="maxWdAmount" type="number" min="0" step="0.01" placeholder={t('createPot.noLimit')} value={maxWithdrawalAmount} onChange={(e) => setMaxWithdrawalAmount(e.target.value)} className="h-11 pl-9" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="maxWdDay">{t('createPot.maxWithdrawalsPerDay')}</Label>
                <Input id="maxWdDay" type="number" min="1" step="1" placeholder={t('createPot.noLimit')} value={maxWithdrawalsPerDay} onChange={(e) => setMaxWithdrawalsPerDay(e.target.value)} className="h-11" />
                <p className="text-xs text-muted-foreground">{t('createPot.maxWithdrawalsPerDayHint')}</p>
              </div>

              <Button className="w-full h-11 rounded-xl" disabled={!withdrawalRule || (withdrawalRule === "requires_password" && !withdrawalPassword.trim())} onClick={() => setStep(3)}>{t('common.next')}</Button>
            </div>
          )}

          {/* Step 3: Receipt & Verification */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('createPot.receiptVerificationDesc')}</p>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card">
                <div>
                  <div className="text-sm font-semibold text-foreground">{t('createPot.requireReceipt')}</div>
                  <div className="text-xs text-muted-foreground">{t('createPot.requireReceiptDesc')}</div>
                </div>
                <button type="button" role="switch" aria-checked={requireReceipt} onClick={() => setRequireReceipt(!requireReceipt)} className={`relative inline-flex h-[28px] w-[48px] shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${requireReceipt ? 'bg-primary' : 'bg-muted'}`}>
                  <span className={`pointer-events-none inline-block h-[24px] w-[24px] rounded-full bg-white shadow-lg transition-transform duration-200 ${requireReceipt ? 'translate-x-[22px]' : 'translate-x-[2px]'} mt-[2px]`} />
                </button>
              </div>


              <Button className="w-full h-11 rounded-xl" onClick={handleCreate} disabled={creating}>
                {creating ? t('createPot.creating') : t('createPot.createPot')}
              </Button>
            </div>
          )}

          {/* Step 4: Initial deposit */}
          {step === 4 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">{t('createPot.almostReady')}</p>
              <div className="space-y-1.5">
                <Label htmlFor="initialDeposit">{t('createPot.depositAmount', { symbol: currencySymbol })}</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm select-none">{currencySymbol}</span>
                  <Input id="initialDeposit" type="number" min="1" step="0.01" placeholder="e.g. 50" value={initialDeposit} onChange={(e) => setInitialDeposit(e.target.value)} autoFocus className="h-11 pl-9" />
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={handleSkipDeposit} type="button" disabled={creating}>
                  {creating ? t('createPot.creating') : t('common.skip')}
                </Button>
                <Button className="flex-1 h-11 rounded-xl" onClick={handleInitialDeposit} disabled={creating || !initialDeposit || parseFloat(initialDeposit) <= 0} type="button">
                  {creating ? t('addFunds.redirecting') : t('createPot.payWithStripe')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
