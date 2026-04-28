import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

const FALLBACK_MESSAGE_DELAY_MS = 10_000;
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_DURATION_MS = 120_000;

export default function PotSuccess() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showFallback, setShowFallback] = useState(false);
  const startedAtRef = useRef<number>(Date.now());
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    cancelledRef.current = false;
    startedAtRef.current = Date.now();

    const fallbackTimer = setTimeout(() => {
      if (!cancelledRef.current) setShowFallback(true);
    }, FALLBACK_MESSAGE_DELAY_MS);

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
      localStorage.removeItem('potCreationState');

      // Poll for balance update from the Stripe webhook.
      // Resolves as soon as balance > 0, or after MAX_POLL_DURATION_MS.
      const pollForBalance = async () => {
        while (!cancelledRef.current) {
          const { data: pot } = await supabase
            .from('pots')
            .select('balance')
            .eq('id', potId)
            .maybeSingle();

          if (cancelledRef.current) return;

          if (pot && Number(pot.balance ?? 0) > 0) return;

          if (Date.now() - startedAtRef.current >= MAX_POLL_DURATION_MS) return;

          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
      };

      await pollForBalance();
      if (cancelledRef.current) return;

      queryClient.invalidateQueries({ queryKey: ['pots'] });
      queryClient.invalidateQueries({ queryKey: ['pot', potId] });

      toast({ title: t('potSuccess.created'), description: t('potSuccess.paymentSuccess') });
      navigate(`/pots/${potId}?payment=success`, { replace: true });
    };

    handleSuccess();

    return () => {
      cancelledRef.current = true;
      clearTimeout(fallbackTimer);
    };
  }, [user, authLoading]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">
          {t('potSuccess.settingUp')}
        </p>
        {showFallback && (
          <p className="text-sm text-foreground/80">
            {t(
              'potSuccess.paymentReceivedFallback',
              'Your payment was received and will appear shortly.'
            )}
          </p>
        )}
      </div>
    </div>
  );
}
