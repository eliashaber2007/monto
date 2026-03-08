import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  potId: string;
  currentPassword: string | null;
  onChanged: () => void;
}

export default function ChangePasswordModal({ open, onOpenChange, potId, currentPassword, onChanged }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setCurrentPw(""); setNewPw(""); setConfirmPw(""); };
  const handleClose = (val: boolean) => { if (!val) reset(); onOpenChange(val); };

  const handleSave = async () => {
    if (currentPassword && currentPw !== currentPassword) {
      toast({ title: t('changePasswordModal.incorrectCurrent'), variant: "destructive" });
      return;
    }
    if (!newPw.trim()) {
      toast({ title: t('changePasswordModal.empty'), variant: "destructive" });
      return;
    }
    if (newPw !== confirmPw) {
      toast({ title: t('changePasswordModal.mismatch'), description: t('changePasswordModal.mismatchDesc'), variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("pots").update({ withdrawal_password: newPw } as any).eq("id", potId);
    setSaving(false);

    if (error) {
      toast({ title: t('changePasswordModal.error'), description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: t('changePasswordModal.updated') });
    reset();
    onOpenChange(false);
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm rounded-2xl p-6 gap-0">
        <DialogHeader className="mb-5">
          <DialogTitle className="text-base flex items-center gap-2">
            <KeyRound size={16} />
            {t('changePasswordModal.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {currentPassword && (
            <div className="space-y-1.5">
              <Label htmlFor="currentPw">{t('changePasswordModal.currentPassword')}</Label>
              <Input id="currentPw" type="password" placeholder={t('changePasswordModal.currentPasswordPlaceholder')} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="h-11" autoFocus />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="newPw">{t('changePasswordModal.newPassword')}</Label>
            <Input id="newPw" type="password" placeholder={t('changePasswordModal.newPasswordPlaceholder')} value={newPw} onChange={(e) => setNewPw(e.target.value)} className="h-11" autoFocus={!currentPassword} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPw">{t('changePasswordModal.confirmPassword')}</Label>
            <Input id="confirmPw" type="password" placeholder={t('changePasswordModal.confirmPasswordPlaceholder')} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="h-11" />
          </div>
          <Button className="w-full h-11 rounded-xl" disabled={saving || !newPw.trim() || !confirmPw.trim() || (!!currentPassword && !currentPw.trim())} onClick={handleSave}>
            {saving ? t('changePasswordModal.saving') : t('changePasswordModal.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
