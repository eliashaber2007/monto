import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export default function PotSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
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
        // No pending pot data — redirect home silently
        navigate('/', { replace: true });
        return;
      }

      const potConfig = JSON.parse(pendingRaw);
      const potId = potConfig.id;

      // Check if pot already exists (webhook may have created it)
      const { data: existingPot } = await supabase
        .from('pots')
        .select('id')
        .eq('id', potId)
        .maybeSingle();

      if (!existingPot) {
        // Webhook hasn't created it yet — create pot now
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
        } as any);

        if (potError) {
          console.error('Error creating pot on success page:', potError);
          // Pot might have been created by webhook between our check and insert — try to continue
        }

        // Add creator as member
        await supabase.from('pot_members').insert({
          pot_id: potId,
          user_id: user.id,
          role: 'creator',
        });
      }

      // Clear pending data
      localStorage.removeItem('pendingPotData');

      toast({ title: '🎉 Pot created!', description: 'Your payment was successful.' });
      navigate(`/pots/${potId}?payment=success`, { replace: true });
    };

    handleSuccess();
  }, [user, authLoading]);

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Setting up your pot…</p>
        </div>
      </div>
    );
  }

  return null;
}
