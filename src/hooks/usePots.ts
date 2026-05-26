import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function usePots() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pots', user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Fetch pot_members for this user, join pots
      const { data, error } = await supabase
        .from('pot_members')
        .select(`
          role,
          pots (
            id,
            name,
            balance,
            peak_balance,
            currency,
            created_at,
            created_by,
            visual_style,
            goal_amount,
            require_receipt,
            withdrawal_rule,
            status,
            emoji
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Also get member counts
      const potIds = (data ?? []).map((pm) => (pm.pots as any)?.id).filter(Boolean);
      let memberCounts: Record<string, number> = {};
      if (potIds.length > 0) {
        const { data: members } = await supabase
          .from('pot_members')
          .select('pot_id')
          .in('pot_id', potIds);
        (members ?? []).forEach((m) => {
          memberCounts[m.pot_id] = (memberCounts[m.pot_id] ?? 0) + 1;
        });
      }

      return (data ?? []).map((pm) => ({
        ...(pm.pots as any),
        role: pm.role,
        memberCount: memberCounts[(pm.pots as any)?.id] ?? 1,
      }));
    },
    enabled: !!user,
    refetchOnMount: true,
    staleTime: 0,
  });
}

export function usePotDetail(potId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pot', potId],
    queryFn: async () => {
      if (!potId || !user) return null;

      const [potRes, membersRes, txRes] = await Promise.all([
        supabase.from('pots').select('*').eq('id', potId).single(),
        supabase.from('pot_members').select('*, profiles:user_id(first_name, avatar_url, avatar_color, avatar_emoji)').eq('pot_id', potId),
        supabase
          .from('transactions')
          .select('*')
          .eq('pot_id', potId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (potRes.error) throw potRes.error;

      const myMember = (membersRes.data ?? []).find((m) => m.user_id === user.id);

      return {
        pot: potRes.data,
        members: membersRes.data ?? [],
        transactions: txRes.data ?? [],
        myRole: myMember?.role ?? 'member',
      };
    },
    enabled: !!potId && !!user,
  });
}
