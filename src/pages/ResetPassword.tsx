import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { establishRecoverySessionFromUrl } from '@/lib/authRecovery';

export default function ResetPassword() {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;

    const confirmSession = async () => {
      const { isRecovery, session, error } = await establishRecoverySessionFromUrl(window.location.href);
      if (error) throw error;

      if (!session && !isRecovery) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          sessionStorage.setItem('auth_active', 'true');
          setReady(true);
          return;
        }
      }

      if (session?.access_token && !cancelled) {
        sessionStorage.setItem('auth_active', 'true');
        window.history.replaceState({}, document.title, '/reset-password');
        setReady(true);
        return;
      }

      throw new Error(t('auth.resetSessionMissing'));
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        sessionStorage.setItem('auth_active', 'true');
        setReady(true);
      }
    });

    (async () => {
      try {
        await confirmSession();
      } catch (err: any) {
        if (!cancelled) {
          const message = err.message ?? t('auth.resetSessionMissing');
          setSessionError(message);
          toast({ title: t('common.error'), description: message, variant: 'destructive' });
        }
      }
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [t, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: t('common.error'), description: t('auth.resetSessionMissing'), variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: t('auth.passwordsDoNotMatch'), variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: t('auth.passwordMinChars'), variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: t('auth.passwordUpdated') });
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">{t('common.monto')}</h1>
        </div>

        <div className="bg-card rounded-2xl shadow-card p-6 border border-border space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{t('auth.setNewPassword')}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">{t('auth.newPassword')}</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">{t('auth.confirmNewPassword')}</Label>
              <Input id="confirm" type="password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="h-11 rounded-xl" />
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl" disabled={loading}>
              {loading ? t('auth.updating') : t('auth.updatePassword')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
