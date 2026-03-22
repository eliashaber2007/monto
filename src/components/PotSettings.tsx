import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { X } from 'lucide-react';

const POT_EMOJIS = [
  "💰", "🏖️", "🎉", "🎁", "✈️", "🏠", "🚗", "🎓", "💍", "🍕",
  "🏋️", "⚽", "🎮", "🎵", "📱", "👶", "🐶", "🌴", "🎄", "💊",
  "🍻", "☕", "📚", "🛍️", "🎬", "🏔️",
];

interface PotSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pot: any;
  members: any[];
  isCreator: boolean;
  onUpdated: () => void;
}

export default function PotSettings({ open, onOpenChange, pot, members, isCreator, onUpdated }: PotSettingsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Editable state (creator only)
  const [name, setName] = useState(pot.name);
  const [emoji, setEmoji] = useState(pot.emoji || '');
  const [goalAmount, setGoalAmount] = useState(pot.goal_amount?.toString() || '');
  const [requireReceipt, setRequireReceipt] = useState(pot.require_receipt);
  const [maxWithdrawalAmount, setMaxWithdrawalAmount] = useState(pot.max_withdrawal_amount?.toString() || '');
  const [contributionsRestricted, setContributionsRestricted] = useState(pot.contributions_restricted);
  const [saving, setSaving] = useState(false);
  const [showReceiptWarning, setShowReceiptWarning] = useState(false);
  const [pendingReceiptValue, setPendingReceiptValue] = useState(false);

  const leaders = members.filter(m => m.role === 'leader');
  const currency = pot.currency ?? 'EUR';

  const handleReceiptToggle = (checked: boolean) => {
    if (!checked && pot.require_receipt) {
      // Turning off — show confirmation
      setPendingReceiptValue(false);
      setShowReceiptWarning(true);
    } else {
      setRequireReceipt(checked);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: any = {
        name: name.trim(),
        emoji: emoji || null,
        goal_amount: goalAmount ? parseFloat(goalAmount) : null,
        require_receipt: requireReceipt,
        max_withdrawal_amount: maxWithdrawalAmount ? parseFloat(maxWithdrawalAmount) : null,
        contributions_restricted: contributionsRestricted,
      };

      const { error } = await supabase
        .from('pots')
        .update(updates)
        .eq('id', pot.id);

      if (error) throw error;

      toast({ title: t('potSettings.updated') });
      queryClient.invalidateQueries({ queryKey: ['pot-detail', pot.id] });
      onUpdated();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  // Read-only view for members/leaders
  if (!isCreator) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle>{t('potSettings.potRules')}</SheetTitle>
          </SheetHeader>
          <div className="space-y-5 pb-6">
            {/* Pot name & emoji */}
            <div className="flex items-center gap-3">
              {pot.emoji && <span className="text-2xl">{pot.emoji}</span>}
              <span className="text-lg font-bold text-foreground">{pot.name}</span>
            </div>

            {/* Target amount */}
            {pot.goal_amount && (
              <div>
                <Label className="text-xs text-muted-foreground">{t('potSettings.targetAmount')}</Label>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(pot.goal_amount)}
                </p>
              </div>
            )}

            {/* Receipt verification */}
            <div>
              <Label className="text-xs text-muted-foreground">{t('potSettings.receiptVerification')}</Label>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {pot.require_receipt ? t('potSettings.enabled') : t('potSettings.disabled')}
              </p>
            </div>

            {/* Max withdrawal */}
            {pot.max_withdrawal_amount && (
              <div>
                <Label className="text-xs text-muted-foreground">{t('potSettings.maxWithdrawal')}</Label>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(pot.max_withdrawal_amount)}
                </p>
              </div>
            )}

            {/* Contribution restrictions */}
            <div>
              <Label className="text-xs text-muted-foreground">{t('potSettings.contributions')}</Label>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {pot.contributions_restricted ? t('potSettings.leadersAndCreator') : t('potSettings.allMembers')}
              </p>
            </div>

            {/* Leaders */}
            {leaders.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">{t('potSettings.leaders')}</Label>
                <div className="mt-1 space-y-1">
                  {leaders.map((l: any) => (
                    <p key={l.id} className="text-sm font-medium text-foreground">
                      ⭐ {l.profiles?.first_name || 'Leader'}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Creation date */}
            <div>
              <Label className="text-xs text-muted-foreground">{t('potSettings.createdOn')}</Label>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {formatDate(pot.created_at)}
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Editable view for creator
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle>{t('potSettings.title')}</SheetTitle>
          </SheetHeader>
          <div className="space-y-5 pb-6">
            {/* Pot name */}
            <div>
              <Label className="text-xs text-muted-foreground">{t('potSettings.potName')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Emoji picker */}
            <div>
              <Label className="text-xs text-muted-foreground">{t('potSettings.icon')}</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {emoji && (
                  <button
                    onClick={() => setEmoji('')}
                    className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
                {POT_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className={`w-9 h-9 rounded-lg border text-lg flex items-center justify-center transition-colors ${
                      emoji === e ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Target amount */}
            <div>
              <Label className="text-xs text-muted-foreground">{t('potSettings.targetAmount')}</Label>
              <Input
                type="number"
                value={goalAmount}
                onChange={(e) => setGoalAmount(e.target.value)}
                placeholder={t('potSettings.noTarget')}
                className="mt-1"
              />
            </div>

            {/* Receipt verification */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">{t('potSettings.receiptVerification')}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t('potSettings.receiptDesc')}</p>
              </div>
              <Switch checked={requireReceipt} onCheckedChange={handleReceiptToggle} />
            </div>

            {/* Max withdrawal amount */}
            <div>
              <Label className="text-xs text-muted-foreground">{t('potSettings.maxWithdrawal')}</Label>
              <Input
                type="number"
                value={maxWithdrawalAmount}
                onChange={(e) => setMaxWithdrawalAmount(e.target.value)}
                placeholder={t('potSettings.noLimit')}
                className="mt-1"
              />
            </div>

            {/* Contribution restrictions */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">{t('potSettings.restrictContributions')}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {contributionsRestricted ? t('potSettings.leadersAndCreator') : t('potSettings.allMembers')}
                </p>
              </div>
              <Switch checked={contributionsRestricted} onCheckedChange={setContributionsRestricted} />
            </div>

            {/* Leaders list (read-only here) */}
            {leaders.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">{t('potSettings.leaders')}</Label>
                <div className="mt-1 space-y-1">
                  {leaders.map((l: any) => (
                    <p key={l.id} className="text-sm font-medium text-foreground">
                      ⭐ {l.profiles?.first_name || 'Leader'}
                    </p>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('potSettings.manageLeadersHint')}</p>
              </div>
            )}

            {/* Creation date */}
            <div>
              <Label className="text-xs text-muted-foreground">{t('potSettings.createdOn')}</Label>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {formatDate(pot.created_at)}
              </p>
            </div>

            {/* Save button */}
            <Button
              className="w-full h-11 rounded-xl font-semibold"
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving ? t('potSettings.saving') : t('potSettings.saveChanges')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Receipt verification warning dialog */}
      <AlertDialog open={showReceiptWarning} onOpenChange={setShowReceiptWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('potSettings.receiptWarningTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('potSettings.receiptWarningDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setRequireReceipt(false);
                setShowReceiptWarning(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('potSettings.turnOff')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
