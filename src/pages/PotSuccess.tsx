import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export default function PotSuccess() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    const handleSuccess = async () => {
      const pendingRaw = localStorage.getItem('pendingPotData');

      if (!pendingRaw) {
        navigate('/', { replace: true });
        return;
      }

      const potConfig = JSON.parse(pendingRaw);
      const potId = potConfig.id;

      const { data: existingPot } = await supabase
        .from('pots')
        .select('id')
        .eq('id', potId)
        .maybeSingle();

      if (!existingPot) {
        const { error: potError } = await supabase.from('pots').insert({
          id: potId,
          name: potConfig.name,
          created_by: user.id,
          visual_style: 'progress_ring',
          currency: potConfig.currency || 'EUR',
          goal_amount: potConfig.goal_amount,
          withdrawal_rule: potConfig.withdrawal_rule || 'auto_approve',
          withdrawal_password: potConfig.withdrawal_password,
          require_receipt: potConfig.require_receipt ?? false,
          max_withdrawal_amount: potConfig.max_withdrawal_amount,
          max_withdrawals_per_day: potConfig.max_withdrawals_per_day,
          emoji: potConfig.emoji,
          contributions_restricted: potConfig.contributions_restricted ?? false,
        } as any);

        if (potError) {
          console.error('Error creating pot on success page:', potError);
        }

        await supabase.from('pot_members').insert({
          pot_id: potId,
          user_id: user.id,
          role: 'creator',
        });
      }

      localStorage.removeItem('pendingPotData');

      queryClient.invalidateQueries({ queryKey: ['pots'] });

      toast({ title: t('potSuccess.created'), description: t('potSuccess.paymentSuccess') });
      navigate(`/pots/${potId}?payment=success`, { replace: true });
    };

    handleSuccess();
  }, [user, authLoading]);

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">{t('potSuccess.settingUp')}</p>
        </div>
      </div>
    );
  }

  return null;
}
