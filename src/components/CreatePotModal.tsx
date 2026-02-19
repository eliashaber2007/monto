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

type VisualStyle = "liquid_bubble" | "progress_ring" | "cake_slice" | "fuel_tank" | "flight_progress";
type WithdrawalRule = "auto_approve" | "requires_approval" | "requires_password";

const VISUAL_STYLES: { id: VisualStyle; label: string; emoji: string; desc: string }[] = [
  { id: "liquid_bubble", label: "Liquid Bubble", emoji: "💧", desc: "Fluid animated fill" },
  { id: "progress_ring", label: "Progress Ring", emoji: "⭕", desc: "Classic circular ring" },
  { id: "cake_slice", label: "Cake Slice", emoji: "🍰", desc: "Pie chart progress" },
  { id: "fuel_tank", label: "Fuel Tank", emoji: "⛽", desc: "Gauge-style fill" },
  { id: "flight_progress", label: "Flight Progress", emoji: "✈️", desc: "Journey tracker" },
];

const WITHDRAWAL_RULES: { id: WithdrawalRule; label: string; desc: string }[] = [
  { id: "auto_approve", label: "Auto-approve", desc: "Withdrawals are instant" },
  { id: "requires_approval", label: "Requires Approval", desc: "Creator must approve each withdrawal" },
  { id: "requires_password", label: "Requires Password", desc: "Members enter a password to withdraw" },
];

// CSS-based animations for each visual style
function StyleAnimation({ style, selected }: { style: VisualStyle; selected: boolean }) {
  const baseClasses = "w-12 h-12 rounded-xl flex items-center justify-center relative overflow-hidden transition-all duration-300";

  if (style === "liquid_bubble") {
    return (
      <div className={`${baseClasses} ${selected ? 'bg-primary' : 'bg-secondary'}`}>
        <div className={`absolute bottom-0 left-0 right-0 bg-primary/30 rounded-b-xl transition-all duration-700 ${selected ? 'h-3/4' : 'h-1/3'}`}
          style={{ animation: 'wave 2s ease-in-out infinite' }} />
        <span className="relative z-10 text-xl">💧</span>
      </div>
    );
  }
  if (style === "progress_ring") {
    return (
      <div className={`${baseClasses} ${selected ? 'bg-primary' : 'bg-secondary'}`}>
        <svg width={28} height={28} viewBox="0 0 28 28" className="relative z-10">
          <circle cx={14} cy={14} r={10} fill="none" stroke={selected ? 'white' : 'hsl(214,32%,85%)'} strokeWidth={3} opacity={0.3} />
          <circle cx={14} cy={14} r={10} fill="none" stroke={selected ? 'white' : 'hsl(221,83%,53%)'} strokeWidth={3}
            strokeLinecap="round" strokeDasharray={62.8} strokeDashoffset={selected ? 15 : 40}
            transform="rotate(-90 14 14)" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        </svg>
      </div>
    );
  }
  if (style === "cake_slice") {
    return (
      <div className={`${baseClasses} ${selected ? 'bg-primary' : 'bg-secondary'}`}>
        <svg width={28} height={28} viewBox="0 0 28 28" className="relative z-10">
          <circle cx={14} cy={14} r={10} fill={selected ? 'rgba(255,255,255,0.2)' : 'hsl(214,32%,85%)'} />
          <path d={`M14,14 L14,4 A10,10 0 ${selected ? '1,1' : '0,1'} ${selected ? '6,21' : '24,14'} Z`}
            fill={selected ? 'white' : 'hsl(221,83%,53%)'} opacity={0.8} />
        </svg>
      </div>
    );
  }
  if (style === "fuel_tank") {
    return (
      <div className={`${baseClasses} ${selected ? 'bg-primary' : 'bg-secondary'}`}>
        <div className="relative z-10 w-6 h-8 border-2 rounded-sm flex flex-col justify-end overflow-hidden"
          style={{ borderColor: selected ? 'white' : 'hsl(221,83%,53%)' }}>
          <div className={`transition-all duration-500 rounded-b-sm ${selected ? 'h-3/4 bg-white/80' : 'h-1/3 bg-primary/60'}`} />
        </div>
      </div>
    );
  }
  // flight_progress
  return (
    <div className={`${baseClasses} ${selected ? 'bg-primary' : 'bg-secondary'}`}>
      <div className="relative z-10 w-8 flex items-center">
        <div className={`h-0.5 flex-1 ${selected ? 'bg-white/40' : 'bg-muted-foreground/30'}`} />
        <span className={`text-lg transition-transform duration-500 ${selected ? 'translate-x-1' : '-translate-x-1'}`}>✈️</span>
      </div>
    </div>
  );
}

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
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("liquid_bubble");
  const [currency, setCurrency] = useState("EUR");
  const [goalAmount, setGoalAmount] = useState("");
  const [withdrawalRule, setWithdrawalRule] = useState<WithdrawalRule>("auto_approve");
  const [withdrawalPassword, setWithdrawalPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [initialDeposit, setInitialDeposit] = useState("");
  const [createdPotId, setCreatedPotId] = useState<string | null>(null);

  const reset = () => {
    setStep(1);
    setPotName("");
    setVisualStyle("liquid_bubble");
    setCurrency("EUR");
    setGoalAmount("");
    setWithdrawalRule("auto_approve");
    setWithdrawalPassword("");
    setInitialDeposit("");
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const redirectToCheckout = async (potId: string, amountEuros: number) => {
    const res = await supabase.functions.invoke("create-checkout-session", {
      body: { pot_id: potId, amount_cents: Math.round(amountEuros * 100) },
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

    const userId = session.user.id;
    const potId = crypto.randomUUID();

    const { error: potError } = await supabase
      .from("pots")
      .insert({
        id: potId,
        name: potName.trim(),
        created_by: userId,
        visual_style: visualStyle,
        currency,
        goal_amount: goalAmount ? parseFloat(goalAmount) : null,
        withdrawal_rule: withdrawalRule,
        withdrawal_password: withdrawalRule === "requires_password" ? withdrawalPassword : null,
      });

    if (potError) {
      setCreating(false);
      toast({ title: "Error creating pot", description: potError?.message ?? "Could not create pot.", variant: "destructive" });
      return;
    }

    const { error: memberError } = await supabase
      .from("pot_members")
      .insert({ pot_id: potId, user_id: userId, role: "creator" });

    if (memberError) {
      setCreating(false);
      toast({ title: "Pot created but member setup failed", description: memberError.message, variant: "destructive" });
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["pots"] });

    if (goalAmount && parseFloat(goalAmount) > 0) {
      try {
        await redirectToCheckout(potId, parseFloat(goalAmount));
      } catch (err: any) {
        setCreating(false);
        toast({ title: "Checkout error", description: err.message ?? "Could not start checkout.", variant: "destructive" });
      }
      return;
    }

    setCreatedPotId(potId);
    setStep(4);
  };

  const handleInitialDeposit = async () => {
    const amount = parseFloat(initialDeposit);
    if (!amount || amount <= 0) {
      toast({ title: "Invalid amount", description: "Please enter an amount greater than 0.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await redirectToCheckout(createdPotId!, amount);
    } catch (err: any) {
      setCreating(false);
      toast({ title: "Checkout error", description: err.message ?? "Could not start checkout.", variant: "destructive" });
    }
  };

  const handleSkipDeposit = () => {
    reset();
    onOpenChange(false);
    toast({ title: "🎉 Pot created!", description: `"${potName}" is ready to go.` });
    navigate(`/pots/${createdPotId}`);
  };

  const currencySymbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  const totalSteps = 3;

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
              {step > 1 && step <= 4 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors -ml-1"
                  type="button"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <DialogTitle className="text-base">
                {step === 1 && "Choose how your pot is displayed ✨"}
                {step === 2 && "Set initial details"}
                {step === 3 && "Withdrawal rules"}
                {step === 4 && "Make an initial deposit 💰"}
              </DialogTitle>
              {step <= 3 && (
                <span className="ml-auto text-xs text-muted-foreground font-medium">
                  {step}/{totalSteps}
                </span>
              )}
            </div>
          </DialogHeader>

          {/* STEP 1 */}
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

              <div>
                <Label className="mb-2 block">Pick a vibe for your pot</Label>
                <div className="space-y-2">
                  {VISUAL_STYLES.map(({ id, label, desc }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setVisualStyle(id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        visualStyle === id
                          ? "border-primary bg-accent shadow-sm"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <StyleAnimation style={id} selected={visualStyle === id} />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-foreground">{label}</div>
                        <div className="text-xs text-muted-foreground">{desc}</div>
                      </div>
                      {visualStyle === id && (
                        <div className="ml-auto w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <Button className="w-full h-11 rounded-xl" disabled={!potName.trim()} onClick={() => setStep(2)}>
                Next
              </Button>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
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

              <Button className="w-full h-11 rounded-xl" onClick={() => setStep(3)}>
                Next
              </Button>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
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

              <Button
                className="w-full h-11 rounded-xl"
                disabled={withdrawalRule === "requires_password" && !withdrawalPassword.trim()}
                onClick={handleCreate}
              >
                {creating ? "Creating…" : "Create Pot 🎉"}
              </Button>
            </div>
          )}

          {/* STEP 4 — Initial deposit */}
          {step === 4 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Your pot is ready! 🎉 Add an initial deposit to kickstart your savings, or skip for now.
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
                  Skip
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
