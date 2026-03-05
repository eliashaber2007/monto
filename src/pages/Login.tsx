import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import SocialLoginButtons from '@/components/SocialLoginButtons';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, loading: authLoading } = useAuth();

  // Redirect authenticated users away from login
  useEffect(() => {
    if (!authLoading && session) {
      navigate('/', { replace: true });
    }
  }, [session, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Grab and REMOVE invite URL BEFORE signIn so AuthContext's
    // SIGNED_IN handler cannot also consume it and trigger a duplicate join
    const pendingInviteUrl = localStorage.getItem('pendingInviteUrl');
    const pendingJoinPotId = localStorage.getItem('pending_join_pot_id');
    localStorage.removeItem('pendingInviteUrl');
    localStorage.removeItem('pending_join_pot_id');

    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      // Restore invite URLs on failure so user can retry
      if (pendingInviteUrl) localStorage.setItem('pendingInviteUrl', pendingInviteUrl);
      if (pendingJoinPotId) localStorage.setItem('pending_join_pot_id', pendingJoinPotId);
      toast({ title: 'Login failed', description: error.message, variant: 'destructive' });
      return;
    }
    if (pendingInviteUrl) {
      // Extract pot ID from /invite/[id] or /join/[id]
      const match = pendingInviteUrl.match(/\/(invite|join)\/([^/?#]+)/);
      const potId = match?.[2];
      const userId = signInData.user?.id;

      if (potId && userId) {
        const { data: existing } = await supabase
          .from('pot_members')
          .select('id')
          .eq('pot_id', potId)
          .eq('user_id', userId)
          .maybeSingle();

        if (!existing) {
          try {
            const { error: insertError } = await supabase.from('pot_members').insert({
              pot_id: potId,
              user_id: userId,
              role: 'member',
            });

            if (insertError) throw insertError;
          } catch (err: any) {
            if (err?.code !== '23505') {
              console.error('Error joining pot after login:', err);
            }
          }
        }

        navigate(`/pots/${potId}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Monto</h1>
        </div>

        <div className="bg-card rounded-2xl shadow-card p-6 border border-border space-y-4">
          <SocialLoginButtons />

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11 rounded-xl" />
            </div>
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl mt-2" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-primary font-semibold hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}
