import { useState, useEffect } from 'react';
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

type WithdrawalRule = 'auto_approve' | 'requires_approval' | 'requires_password';

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

  const [name, setName] = useState(pot.name);
  const [emoji, setEmoji] = useState(pot.emoji || '');
  const [requireReceipt, setRequireReceipt] = useState(pot.require_receipt);
  const [maxWithdrawalAmount, setMaxWithdrawalAmount] = useState(pot.max_withdrawal_amount?.toString() || '');
  const [withdrawalRule, setWithdrawalRule] = useState<WithdrawalRule>(pot.withdrawal_rule || 'auto_approve');
  const [withdrawalRule, setWithdrawalRule] = useState<WithdrawalRule>(pot.withdrawal_rule || 'auto_approve');
  const [withdrawalPassword, setWithdrawalPassword] = useState(pot.withdrawal_password || '');
  const [saving, setSaving] = useState(false);
  const [showReceiptWarning, setShowReceiptWarning] = useState(false);
  const [pendingReceiptValue, setPendingReceiptValue] = useState(false);

  // Sync state when pot data changes (e.g. reopening settings or after refetch)
  useEffect(() => {
    setName(pot.name);
    setEmoji(pot.emoji || '');
    setRequireReceipt(pot.require_receipt);
    setMaxWithdrawalAmount(pot.max_withdrawal_amount?.toString() || '');
    setContributionsRestricted(pot.contributions_restricted);
    setWithdrawalRule(pot.withdrawal_rule || 'auto_approve');
    setWithdrawalPassword(pot.withdrawal_password || '');
  }, [pot]);

  const leaders = members.filter(m => m.role === 'leader');
  const currency = pot.currency ?? 'EUR';

  const WITHDRAWAL_RULES: { id: WithdrawalRule; label: string; desc: string }[] = [
    { id: 'requires_approval', label: t('potSettings.securityApproval'), desc: t('potSettings.securityApprovalDesc') },
    { id: 'requires_password', label: t('potSettings.securityPassword'), desc: t('potSettings.securityPasswordDesc') },
    { id: 'auto_approve', label: t('potSettings.securityNone'), desc: t('potSettings.securityNoneDesc') },
  ];

  const handleReceiptToggle = (checked: boolean) => {
    if (!checked && pot.require_receipt) {
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
        require_receipt: requireReceipt,
        max_withdrawal_amount: maxWithdrawalAmount ? parseFloat(maxWithdrawalAmount) : null,
        contributions_restricted: contributionsRestricted,
        withdrawal_rule: withdrawalRule,
        withdrawal_password: withdrawalRule === 'requires_password' ? withdrawalPassword : null,
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
            <div className="flex items-center gap-3">
              {pot.emoji && <span className="text-2xl">{pot.emoji}</span>}
              <span className="text-lg font-bold text-foreground">{pot.name}</span>
            </div>

            {/* Withdrawal security */}
            <div>
              <Label className="text-xs text-muted-foreground">{t('potSettings.withdrawalSecurity')}</Label>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {pot.withdrawal_rule === 'requires_approval' && t('potSettings.securityReadOnlyApproval')}
                {pot.withdrawal_rule === 'requires_password' && t('potSettings.securityReadOnlyPassword')}
                {pot.withdrawal_rule === 'auto_approve' && t('potSettings.securityReadOnlyNone')}
              </p>
            </div>

            {/* Target amount (read-only, still shown) */}
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
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
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

            {/* Withdrawal Security */}
            <div>
              <Label className="text-xs text-muted-foreground">{t('potSettings.withdrawalSecurity')}</Label>
              <div className="space-y-2 mt-1.5">
                {WITHDRAWAL_RULES.map(({ id, label, desc }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setWithdrawalRule(id)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                      withdrawalRule === id ? 'border-primary bg-accent shadow-sm' : 'border-border bg-card hover:border-primary/40'
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

              {withdrawalRule === 'requires_password' && (
                <div className="mt-3">
                  <Label className="text-xs text-muted-foreground">{t('potSettings.potPassword')}</Label>
                  <Input
                    type="password"
                    value={withdrawalPassword}
                    onChange={(e) => setWithdrawalPassword(e.target.value)}
                    placeholder={t('potSettings.potPasswordPlaceholder')}
                    className="mt-1"
                  />
                </div>
              )}
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

            {/* Leaders list */}
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
              disabled={saving || !name.trim() || (withdrawalRule === 'requires_password' && !withdrawalPassword.trim())}
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
