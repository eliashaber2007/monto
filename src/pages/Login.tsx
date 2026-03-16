import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import SocialLoginButtons from '@/components/SocialLoginButtons';
import { CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', emoji: '🇬🇧', label: 'EN' },
  { code: 'fr', emoji: '🇫🇷', label: 'FR' },
  { code: 'de', emoji: '🇩🇪', label: 'DE' },
  { code: 'es', emoji: '🇪🇸', label: 'ES' },
];

function LanguageSelector() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-card border border-border text-foreground hover:bg-accent transition-colors"
      >
        <span aria-hidden="true">{current.emoji}</span>
        <span>{current.label}</span>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-modal py-1 z-50 min-w-[100px]">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { i18n.changeLanguage(lang.code); setOpen(false); }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors ${
                i18n.language === lang.code
                  ? 'text-primary font-semibold bg-accent'
                  : 'text-foreground hover:bg-accent'
              }`}
            >
              <span aria-hidden="true">{lang.emoji}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showUnverified, setShowUnverified] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { session, loading: authLoading } = useAuth();

  const isVerified = searchParams.get('verified') === 'true';

  useEffect(() => {
    if (!authLoading && session) {
      navigate('/', { replace: true });
    }
  }, [session, authLoading, navigate]);

  useEffect(() => {
    if (isVerified) {
      const timer = setTimeout(() => setSearchParams({}, { replace: true }), 10000);
      return () => clearTimeout(timer);
    }
  }, [isVerified, setSearchParams]);

  const handleResendVerification = async () => {
    if (!email) {
      toast({ title: t('auth.enterEmail'), description: t('auth.enterEmailDesc'), variant: 'destructive' });
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/verified` },
    });
    setResending(false);
    if (error) {
      toast({ title: t('auth.couldNotResend'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('auth.verificationEmailSent'), description: t('auth.checkInboxForLink') });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setShowUnverified(false);

    const pendingInviteUrl = localStorage.getItem('pendingInviteUrl');
    const pendingJoinPotId = localStorage.getItem('pending_join_pot_id');
    localStorage.removeItem('pendingInviteUrl');
    localStorage.removeItem('pending_join_pot_id');

    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      if (pendingInviteUrl) localStorage.setItem('pendingInviteUrl', pendingInviteUrl);
      if (pendingJoinPotId) localStorage.setItem('pending_join_pot_id', pendingJoinPotId);

      if (error.message.toLowerCase().includes('email not confirmed')) {
        setShowUnverified(true);
        return;
      }

      toast({ title: t('auth.loginFailed'), description: error.message, variant: 'destructive' });
      return;
    }

    if (pendingInviteUrl) {
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      {/* Language selector — top right */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-sm">
        {/* Brand title — above the card */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">{t('common.monto')}</h1>
        </div>

        {isVerified && (
          <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl px-4 py-3 mb-5 text-sm">
            <CheckCircle2 size={18} className="flex-shrink-0" />
            <span>{t('auth.emailVerified')}</span>
          </div>
        )}

        {showUnverified && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-xl px-4 py-3 mb-5 text-sm space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{t('auth.verifyEmail')}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResendVerification}
              disabled={resending}
              className="w-full text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30"
            >
              {resending ? t('auth.sending') : t('auth.resendVerification')}
            </Button>
          </div>
        )}

        <div className="bg-card rounded-2xl shadow-card p-7 border border-border space-y-5">
          <SocialLoginButtons />

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 rounded-xl" />
            </div>
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">{t('auth.forgotPassword')}</Link>
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl mt-1" disabled={loading}>
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          {t('auth.noAccount')}{' '}
          <Link to="/signup" className="text-primary font-semibold hover:underline">{t('auth.createOne')}</Link>
        </p>
      </div>
    </div>
  );
}