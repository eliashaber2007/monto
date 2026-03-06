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

type WithdrawalRule = "auto_approve" | "requires_approval" | "requires_password";

const WITHDRAWAL_RULES: { id: WithdrawalRule; label: string; desc: string }[] = [
  { id: "auto_approve", label: "Auto-approve", desc: "Withdrawals are instant" },
  { id: "requires_approval", label: "Requires Approval", desc: "Creator must approve each withdrawal" },
  { id: "requires_password", label: "Requires Password", desc: "Members enter a password to withdraw" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreatePotModal({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [potName, setPotName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [goalAmount, setGoalAmount] = useState("");
  const [withdrawalRule, setWithdrawalRule] = useState<WithdrawalRule>("auto_approve");
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
    setStep(1);
    setPotName("");
    setCurrency("EUR");
    setGoalAmount("");
    setWithdrawalRule("auto_approve");
    setWithdrawalPassword("");
    setInitialDeposit("");
    setRequireReceipt(false);
    setMaxWithdrawalAmount("");
    setMaxWithdrawalsPerDay("");
    setSelectedEmoji(null);
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const buildPotConfig = () => ({
    id: crypto.randomUUID(),
    name: potName.trim(),
    currency,
    goal_amount: goalAmount ? parseFloat(goalAmount) : null,
    withdrawal_rule: withdrawalRule,
    withdrawal_password: withdrawalRule === "requires_password" ? withdrawalPassword : null,
    require_receipt: requireReceipt,
    max_withdrawal_amount: maxWithdrawalAmount ? parseFloat(maxWithdrawalAmount) : null,
    max_withdrawals_per_day: maxWithdrawalsPerDay ? parseInt(maxWithdrawalsPerDay) : null,
  });

  const redirectToCheckout = async (potConfig: ReturnType<typeof buildPotConfig>, amountEuros: number) => {
    // Store pending pot data in localStorage
    localStorage.setItem('pendingPotData', JSON.stringify(potConfig));

    const res = await supabase.functions.invoke("create-checkout-session", {
      body: {
        pot_id: potConfig.id,
        amount_cents: Math.round(amountEuros * 100),
        is_new_pot: true,
        pot_config: {
          name: potConfig.name,
          currency: potConfig.currency,
          goal_amount: potConfig.goal_amount,
          withdrawal_rule: potConfig.withdrawal_rule,
          withdrawal_password: potConfig.withdrawal_password,
          require_receipt: potConfig.require_receipt,
          max_withdrawal_amount: potConfig.max_withdrawal_amount,
          max_withdrawals_per_day: potConfig.max_withdrawals_per_day,
        },
      },
    });
    if (res.error) throw res.error;
    const { url } = res.data as { url: string };
    if (url) window.location.href = url;
  };

  const handleCreate = async () => {
    if (!potName.trim()) {
      toast({ title: "Missing pot name", description: "Please enter a name for your pot.", variant: "destructive" });
      return;
    }

    setCreating(true);

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const session = sessionData?.session;

    if (sessionError || !session) {
      setCreating(false);
      toast({ title: "Not signed in", description: "Please sign in again.", variant: "destructive" });
      return;
    }

    // If goal amount is set, go straight to Stripe checkout (pot created after payment)
    if (goalAmount && parseFloat(goalAmount) > 0) {
      const potConfig = buildPotConfig();
      try {
        await redirectToCheckout(potConfig, parseFloat(goalAmount));
      } catch (err: any) {
        setCreating(false);
        toast({ title: "Checkout error", description: err.message ?? "Could not start checkout.", variant: "destructive" });
      }
      return;
    }

    // No goal amount — show step 3 for optional initial deposit
    // Generate pot config but don't create in DB yet
    const potConfig = buildPotConfig();
    setCreatedPotId(potConfig.id);
    // Store config temporarily for step 3
    localStorage.setItem('pendingPotData', JSON.stringify(potConfig));
    setStep(3);
    setCreating(false);
  };

  const handleInitialDeposit = async () => {
    const amount = parseFloat(initialDeposit);
    if (!amount || amount <= 0) {
      toast({ title: "Invalid amount", description: "Please enter an amount greater than 0.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const pendingData = JSON.parse(localStorage.getItem('pendingPotData') || '{}');
      await redirectToCheckout(pendingData, amount);
    } catch (err: any) {
      setCreating(false);
      toast({ title: "Checkout error", description: err.message ?? "Could not start checkout.", variant: "destructive" });
    }
  };

  const handleSkipDeposit = async () => {
    // No payment — create pot in DB immediately
    setCreating(true);
    const pendingRaw = localStorage.getItem('pendingPotData');
    if (!pendingRaw) {
      setCreating(false);
      toast({ title: "Error", description: "Missing pot data.", variant: "destructive" });
      return;
    }
    const potConfig = JSON.parse(pendingRaw);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) {
      setCreating(false);
      toast({ title: "Not signed in", variant: "destructive" });
      return;
    }

    const { error: potError } = await supabase.from("pots").insert({
      id: potConfig.id,
      name: potConfig.name,
      created_by: userId,
      visual_style: "progress_ring",
      currency: potConfig.currency,
      goal_amount: potConfig.goal_amount,
      withdrawal_rule: potConfig.withdrawal_rule,
      withdrawal_password: potConfig.withdrawal_password,
      require_receipt: potConfig.require_receipt,
      max_withdrawal_amount: potConfig.max_withdrawal_amount,
      max_withdrawals_per_day: potConfig.max_withdrawals_per_day,
    } as any);

    if (potError) {
      setCreating(false);
      toast({ title: "Error creating pot", description: potError.message, variant: "destructive" });
      return;
    }

    await supabase.from("pot_members").insert({ pot_id: potConfig.id, user_id: userId, role: "creator" });

    localStorage.removeItem('pendingPotData');
    queryClient.invalidateQueries({ queryKey: ["pots"] });
    setCreating(false);
    reset();
    onOpenChange(false);
    toast({ title: "🎉 Pot created!", description: `"${potConfig.name}" is ready to go.` });
    navigate(`/pots/${potConfig.id}`);
  };

  const currencySymbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  const totalSteps = 2;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden gap-0">
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${(Math.min(step, totalSteps) / totalSteps) * 100}%` }}
          />
        </div>

        <div className="p-6">
          <DialogHeader className="mb-5">
            <div className="flex items-center gap-2">
              {step > 1 && step <= 3 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors -ml-1"
                  type="button"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <DialogTitle className="text-base">
                {step === 1 && "Set up your pot ✨"}
                {step === 2 && "Withdrawal rules"}
                {step === 3 && "Make an initial deposit 💰"}
              </DialogTitle>
              {step <= 2 && (
                <span className="ml-auto text-xs text-muted-foreground font-medium">
                  {step}/{totalSteps}
                </span>
              )}
            </div>
          </DialogHeader>

          {/* STEP 1 — Pot details */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="potName">Pot name</Label>
                <Input
                  id="potName"
                  placeholder="e.g. Holiday Fund 🏖️"
                  value={potName}
                  onChange={(e) => setPotName(e.target.value)}
                  autoFocus
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR — Euro (€)</SelectItem>
                    <SelectItem value="GBP">GBP — British Pound (£)</SelectItem>
                    <SelectItem value="USD">USD — US Dollar ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="goalAmount">Pot amount (optional)</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm select-none">
                    {currencySymbol}
                  </span>
                  <Input
                    id="goalAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 1000"
                    value={goalAmount}
                    onChange={(e) => setGoalAmount(e.target.value)}
                    className="h-11 pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Leave blank for an open-ended pot</p>
              </div>

              <Button className="w-full h-11 rounded-xl" disabled={!potName.trim()} onClick={() => setStep(2)}>
                Next
              </Button>
            </div>
          )}

          {/* STEP 2 — Withdrawal rules */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                {WITHDRAWAL_RULES.map(({ id, label, desc }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setWithdrawalRule(id)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                      withdrawalRule === id
                        ? "border-primary bg-accent shadow-sm"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-foreground">{label}</div>
                      <div className="text-xs text-muted-foreground">{desc}</div>
                    </div>
                    {withdrawalRule === id && (
                      <div className="ml-auto w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {withdrawalRule === "requires_password" && (
                <div className="space-y-1.5">
                  <Label htmlFor="wdPw">Withdrawal password</Label>
                  <Input
                    id="wdPw"
                    type="password"
                    placeholder="Set a password for withdrawals"
                    value={withdrawalPassword}
                    onChange={(e) => setWithdrawalPassword(e.target.value)}
                    className="h-11"
                  />
                </div>
              )}

              {/* Receipt verification toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card">
                <div>
                  <div className="text-sm font-semibold text-foreground">Require receipt for withdrawals</div>
                  <div className="text-xs text-muted-foreground">Members must upload proof after withdrawing</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={requireReceipt}
                  onClick={() => setRequireReceipt(!requireReceipt)}
                  className={`relative inline-flex h-[28px] w-[48px] shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                    requireReceipt ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-[24px] w-[24px] rounded-full bg-white shadow-lg transition-transform duration-200 ${
                    requireReceipt ? 'translate-x-[22px]' : 'translate-x-[2px]'
                  } mt-[2px]`} />
                </button>
              </div>

              {/* Max withdrawal amount */}
              <div className="space-y-1.5">
                <Label htmlFor="maxWdAmount">Max withdrawal amount (optional)</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm select-none">
                    {currencySymbol}
                  </span>
                  <Input
                    id="maxWdAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="No limit"
                    value={maxWithdrawalAmount}
                    onChange={(e) => setMaxWithdrawalAmount(e.target.value)}
                    className="h-11 pl-9"
                  />
                </div>
              </div>

              {/* Max withdrawals per day */}
              <div className="space-y-1.5">
                <Label htmlFor="maxWdDay">Max withdrawals per day (optional)</Label>
                <Input
                  id="maxWdDay"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="No limit"
                  value={maxWithdrawalsPerDay}
                  onChange={(e) => setMaxWithdrawalsPerDay(e.target.value)}
                  className="h-11"
                />
              </div>

              <Button
                className="w-full h-11 rounded-xl"
                disabled={withdrawalRule === "requires_password" && !withdrawalPassword.trim()}
                onClick={handleCreate}
              >
                {creating ? "Creating…" : "Create Pot 🎉"}
              </Button>
            </div>
          )}

          {/* STEP 3 — Initial deposit */}
          {step === 3 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Your pot is almost ready! 🎉 Add an initial deposit to kickstart your savings, or skip for now.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="initialDeposit">
                  Deposit amount ({currencySymbol})
                </Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm select-none">
                    {currencySymbol}
                  </span>
                  <Input
                    id="initialDeposit"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="e.g. 50"
                    value={initialDeposit}
                    onChange={(e) => setInitialDeposit(e.target.value)}
                    autoFocus
                    className="h-11 pl-9"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-xl"
                  onClick={handleSkipDeposit}
                  type="button"
                  disabled={creating}
                >
                  {creating ? "Creating…" : "Skip"}
                </Button>
                <Button
                  className="flex-1 h-11 rounded-xl"
                  onClick={handleInitialDeposit}
                  disabled={creating || !initialDeposit || parseFloat(initialDeposit) <= 0}
                  type="button"
                >
                  {creating ? "Redirecting…" : "Pay with Stripe"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
