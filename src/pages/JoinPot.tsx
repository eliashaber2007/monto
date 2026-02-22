import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Users } from 'lucide-react';

const PENDING_JOIN_KEY = 'pending_join_pot_id';

export function getPendingJoinPotId(): string | null {
  return localStorage.getItem(PENDING_JOIN_KEY);
}

export function clearPendingJoinPotId() {
  localStorage.removeItem(PENDING_JOIN_KEY);
}

export default function JoinPot() {
  const { potId } = useParams<{ potId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Save pot id and redirect to login
      if (potId) localStorage.setItem(PENDING_JOIN_KEY, potId);
      navigate('/login', { replace: true });
      return;
    }

    if (!potId) return;

    // User is logged in — attempt to join
    const joinPot = async () => {
      setJoining(true);

      // Check if already a member
      const { data: membership } = await supabase
        .from('pot_members')
        .select('id')
        .eq('pot_id', potId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (membership) {
        navigate(`/pots/${potId}`, { replace: true });
        return;
      }

      const { error } = await supabase
        .from('pot_members')
        .insert({ pot_id: potId, user_id: user.id, role: 'member' });

      if (error) {
        toast({ title: 'Error joining pot', description: error.message, variant: 'destructive' });
        navigate('/', { replace: true });
        return;
      }

      // Get pot name for the toast
      const { data: pot } = await supabase
        .from('pots')
        .select('name')
        .eq('id', potId)
        .maybeSingle();

      toast({ title: `You've joined ${pot?.name ?? 'the pot'}! 🎉` });
      navigate(`/pots/${potId}`, { replace: true });
    };

    joinPot();
  }, [user, authLoading, potId, navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-card rounded-2xl border border-border p-10 text-center max-w-sm w-full shadow-sm">
        <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-5">
          <Users size={28} className="text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Joining pot…</h1>
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mt-4" />
      </div>
    </div>
  );
}
