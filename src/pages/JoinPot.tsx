import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';

export default function JoinPot() {
  const { potId } = useParams<{ potId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [potName, setPotName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);

  useEffect(() => {
    if (!potId || !user) return;

    const load = async () => {
      // Check if already a member
      const { data: membership } = await supabase
        .from('pot_members')
        .select('id')
        .eq('pot_id', potId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (membership) {
        setAlreadyMember(true);
        setLoading(false);
        return;
      }

      // Get pot name - use service role via RPC or just try to fetch
      // Since non-members can't read pots via RLS, we'll show a generic message
      setLoading(false);
    };

    load();
  }, [potId, user]);

  const handleJoin = async () => {
    if (!potId || !user) return;
    setJoining(true);

    const { error } = await supabase
      .from('pot_members')
      .insert({ pot_id: potId, user_id: user.id, role: 'member' });

    if (error) {
      setJoining(false);
      toast({ title: 'Error joining pot', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: '🎉 You joined the pot!', description: 'Welcome aboard!' });
    navigate(`/pots/${potId}`);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-5">
        <div className="bg-card rounded-2xl border border-border p-10 text-center max-w-sm w-full shadow-sm">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-5">
            <Users size={28} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">You've been invited!</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Sign in or create an account to join this savings pot.
          </p>
          <div className="space-y-3">
            <Button className="w-full h-11 rounded-xl" onClick={() => navigate('/login')}>
              Sign In
            </Button>
            <Button variant="outline" className="w-full h-11 rounded-xl" onClick={() => navigate('/signup')}>
              Create Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (alreadyMember) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-5">
        <div className="bg-card rounded-2xl border border-border p-10 text-center max-w-sm w-full shadow-sm">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl">✅</span>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">You're already a member!</h1>
          <p className="text-sm text-muted-foreground mb-6">
            You're already part of this pot.
          </p>
          <Button className="w-full h-11 rounded-xl" onClick={() => navigate(`/pots/${potId}`)}>
            Go to Pot
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="bg-card rounded-2xl border border-border p-10 text-center max-w-sm w-full shadow-sm">
        <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-5">
          <Users size={28} className="text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">You've been invited! 🎉</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Someone invited you to join their savings pot. Tap below to join and start saving together!
        </p>
        <Button
          className="w-full h-11 rounded-xl font-semibold"
          onClick={handleJoin}
          disabled={joining}
        >
          {joining ? 'Joining…' : 'Join Pot'}
        </Button>
      </div>
    </div>
  );
}
