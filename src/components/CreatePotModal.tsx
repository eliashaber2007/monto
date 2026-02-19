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
    setCreating(true);

    // 🔥 Guarantee authenticated user at insert time
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const authedUser = userData?.user;

    if (userError || !authedUser) {
      setCreating(false);
      toast({
        title: "Not signed in",
        description: "Please sign in again, then try creating a pot.",
        variant: "destructive",
      });
      return;
    }

    const { data: pot, error } = await supabase
      .from("pots")
      .insert({
        name: potName.trim(),
        creator_id: authedUser.id, // ✅ Correct column name
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

    if (error || !pot) {
      setCreating(false);
      toast({
        title: "Error",
        description: error?.message ?? "Could not create pot.",
        variant: "destructive",
      });
      return;
    }

    const { error: memberError } = await supabase
      .from("pot_members")
      .insert({ pot_id: pot.id, user_id: authedUser.id, role: "creator" });

    setCreating(false);

    if (memberError) {
      toast({
        title: "Error",
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
            <DialogTitle className="text-base">
              {step === 1 && "Choose a visual style"}
              {step === 2 && "Set initial details"}
              {step === 3 && "Withdrawal rules"}
              {step === 4 && "Spending verification"}
            </DialogTitle>
          </DialogHeader>

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

              <Button className="w-full h-11 rounded-xl" disabled={!potName.trim()} onClick={() => setStep(2)}>
                Next
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="flex gap-3">
              <Button className="flex-1 h-11 rounded-xl" onClick={handleCreate} disabled={creating}>
                {creating ? "Creating…" : "Create Pot"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
