import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplets, CircleDot, PieChart, Fuel, Plane, ChevronLeft, Receipt, Clock } from "lucide-react";

type VisualStyle = "liquid_bubble" | "progress_ring" | "cake_slice" | "fuel_tank" | "flight_progress";
type WithdrawalRule = "auto_approve" | "requires_approval" | "requires_password";

const VISUAL_STYLES: { id: VisualStyle; label: string; Icon: React.ElementType; desc: string }[] = [
  { id: "liquid_bubble", label: "Liquid Bubble", Icon: Droplets, desc: "Fluid animated fill" },
  { id: "progress_ring", label: "Progress Ring", Icon: CircleDot, desc: "Classic circular ring" },
  { id: "cake_slice", label: "Cake Slice", Icon: PieChart, desc: "Pie chart progress" },
  { id: "fuel_tank", label: "Fuel Tank", Icon: Fuel, desc: "Gauge-style fill" },
  { id: "flight_progress", label: "Flight Progress", Icon: Plane, desc: "Journey tracker" },
];

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
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("liquid_bubble");
  const [currency, setCurrency] = useState("EUR");
  const [goalAmount, setGoalAmount] = useState("");
  const [withdrawalRule, setWithdrawalRule] = useState<WithdrawalRule>("auto_approve");
  const [withdrawalPassword, setWithdrawalPassword] = useState("");
  const [requireReceipt, setRequireReceipt] = useState(false);
  const [receiptWindowDays, setReceiptWindowDays] = useState(7);
  const [creating, setCreating] = useState(false);

  const reset = () => {
    setStep(1);
    setPotName("");
    setVisualStyle("liquid_bubble");
    setCurrency("EUR");
    setGoalAmount("");
    setWithdrawalRule("auto_approve");
    setWithdrawalPassword("");
    setRequireReceipt(false);
    setReceiptWindowDays(7);
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const handleCreate = async () => {
    if (!potName.trim()) {
      toast({
        title: "Missing pot name",
        description: "Please enter a name for your pot.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const session = sessionData?.session;

    if (sessionError || !session) {
      setCreating(false);
      toast({
        title: "Not signed in",
        description: "Please sign in again, then try creating a pot.",
        variant: "destructive",
      });
      return;
    }

    const userId = session.user.id;

    const { data: pot, error: potError } = await supabase
      .from("pots")
      .insert({
        name: potName.trim(),
        creator_id: userId,
        visual_style: visualStyle,
        currency,
        goal_amount: goalAmount ? parseFloat(goalAmount) : null,
        withdrawal_rule: withdrawalRule,
        withdrawal_password: withdrawalRule === "requires_password" ? withdrawalPassword : null,
        require_receipt: requireReceipt,
        receipt_window_days: receiptWindowDays,
      })
      .select()
      .single();

    if (potError || !pot) {
      setCreating(false);
      toast({
        title: "Error creating pot",
        description: potError?.message ?? "Could not create pot.",
        variant: "destructive",
      });
      return;
    }

    const { error: memberError } = await supabase
      .from("pot_members")
      .insert({ pot_id: pot.id, user_id: userId, role: "creator" });

    setCreating(false);

    if (memberError) {
      toast({
        title: "Pot created but member setup failed",
        description: memberError.message,
        variant: "destructive",
      });
      return;
    }

    reset();
    onOpenChange(false);
    queryClient.invalidateQueries({ queryKey: ["pots"] });
    toast({ title: "Pot created!", description: `"${pot.name}" is ready.` });
    navigate(`/pots/${pot.id}`);
  };

  const totalSteps = 4;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden gap-0">
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        <div className="p-6">
          <DialogHeader className="mb-5">
            <div className="flex items-center gap-2">
              {step > 1 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors -ml-1"
                  type="button"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <DialogTitle className="text-base">
                {step === 1 && "Choose a visual style"}
                {step === 2 && "Set initial details"}
                {step === 3 && "Withdrawal rules"}
                {step === 4 && "Spending verification"}
              </DialogTitle>
              <span className="ml-auto text-xs text-muted-foreground font-medium">
                {step}/{totalSteps}
              </span>
            </div>
          </DialogHeader>

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="potName">Pot name</Label>
                <Input
                  id="potName"
                  placeholder="e.g. Holiday Fund"
                  value={potName}
                  onChange={(e) => setPotName(e.target.value)}
                  autoFocus
                  className="h-11"
                />
              </div>

              <div>
                <Label className="mb-2 block">Visual style</Label>
                <div className="space-y-2">
                  {VISUAL_STYLES.map(({ id, label, Icon, desc }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setVisualStyle(id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        visualStyle === id
                          ? "border-primary bg-accent"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          visualStyle === id ? "bg-primary" : "bg-secondary"
                        }`}
                      >
                        <Icon
                          size={18}
                          className={visualStyle === id ? "text-primary-foreground" : "text-muted-foreground"}
                        />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{label}</div>
                        <div className="text-xs text-muted-foreground">{desc}</div>
                      </div>
                      {visualStyle === id && (
                        <div className="ml-auto w-4 h-4 rounded-full bg-primary flex items-center justify-center">
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
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="EUR">EUR — Euro (€)</option>
                  <option value="GBP">GBP — British Pound (£)</option>
                  <option value="USD">USD — US Dollar ($)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="goalAmount">Savings goal (optional)</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm select-none">
                    {currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$"}
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
                        ? "border-primary bg-accent"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-foreground">{label}</div>
                      <div className="text-xs text-muted-foreground">{desc}</div>
                    </div>
                    {withdrawalRule === id && (
                      <div className="ml-auto w-4 h-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
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
                onClick={() => setStep(4)}
              >
                Next
              </Button>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="space-y-5">
              <div
                className={`rounded-xl border p-4 cursor-pointer transition-all ${
                  requireReceipt ? "border-primary bg-accent" : "border-border bg-card"
                }`}
                onClick={() => setRequireReceipt((r) => !r)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      requireReceipt ? "bg-primary" : "bg-secondary"
                    }`}
                  >
                    <Receipt
                      size={18}
                      className={requireReceipt ? "text-primary-foreground" : "text-muted-foreground"}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">Require receipt upload</span>
                      <div
                        className={`relative rounded-full transition-colors flex-shrink-0 ${
                          requireReceipt ? "bg-primary" : "bg-muted"
                        }`}
                        style={{ height: "22px", width: "40px" }}
                      >
                        <div
                          className={`absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-all ${
                            requireReceipt ? "left-[18px]" : "left-0.5"
                          }`}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Members must upload a receipt after each withdrawal
                    </p>
                  </div>
                </div>
              </div>

              {requireReceipt && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <Clock size={13} className="text-muted-foreground" />
                      Upload window
                    </Label>
                    <div className="flex gap-2">
                      {[3, 7, 14, 30].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setReceiptWindowDays(d)}
                          className={`flex-1 h-9 rounded-lg text-xs font-semibold border transition-all ${
                            receiptWindowDays === d
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-foreground border-border hover:border-primary/40"
                          }`}
                        >
                          {d}d
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Members have {receiptWindowDays} days to submit a receipt
                    </p>
                  </div>

                  <div className="bg-secondary rounded-xl p-3 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-warning flex-shrink-0" />
                      Receipt Pending — waiting for upload
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      Submitted — awaiting creator review
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
                      Approved by creator
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" />
                      Rejected / Expired
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setStep(3)} type="button">
                  Back
                </Button>
                <Button className="flex-1 h-11 rounded-xl" onClick={handleCreate} disabled={creating} type="button">
                  {creating ? "Creating…" : "Create Pot"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
