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
import { getPendingInviteToken, savePendingInviteToken, clearPendingInvite } from '@/lib/inviteJoin';

const LANGUAGES = [
  { code: 'en', emoji: '🇬🇧', label: 'EN' },
  { code: 'fr', emoji: '🇫🇷', label: 'FR' },
  { code: 'de', emoji: '🇩🇪', label: 'DE' },
  { code: 'es', emoji: '🇪🇸', label: 'ES' },
  { code: 'it', emoji: '🇮🇹', label: 'IT' },
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
  console.log('[Login] Page loaded at URL:', window.location.href);

  const { toast, dismiss, clear } = useToast();

  const hasClearedInitialToasts = useRef(false);
  if (!hasClearedInitialToasts.current) {
    hasClearedInitialToasts.current = true;
    clear();
    dismiss();
  }

  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showUnverified, setShowUnverified] = useState(false);
  const [showOAuthSuggestion, setShowOAuthSuggestion] = useState(false);
  const hasProcessedPendingInvite = useRef(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, loading: authLoading } = useAuth();

  const isVerified = searchParams.get('verified') === 'true';

  // Check for invite param in URL and save to localStorage synchronously before render
  // This ensures SocialLoginButtons can read it immediately when constructing OAuth redirect_uri
  const inviteParam = searchParams.get('invite');
  if (inviteParam) {
    console.log('[Login] Found invite param in URL:', inviteParam);
    savePendingInviteToken(inviteParam);
    console.log('[Login] Saved invite to localStorage');
  }

  // Listen for SIGNED_IN and INITIAL_SESSION events from OAuth callback
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Login] Auth state change event:', event, 'hasSession:', !!session);

      // SIGNED_IN fires for fresh logins, INITIAL_SESSION fires when session already exists (OAuth redirect)
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && !hasProcessedPendingInvite.current) {
        console.log(`[Login] ✅ ${event} event fired!`, {
          sessionId: session.user.id,
          hasProcessedBefore: hasProcessedPendingInvite.current,
          currentPath: window.location.pathname,
        });

        hasProcessedPendingInvite.current = true;
        clear();
        dismiss();

        // Clean up auth_active flag after successful OAuth
        localStorage.removeItem('auth_active');

        // Check if user has accepted terms
        // NOTE: terms_accepted column temporarily disabled - add via migration if needed
        // const { data: profile } = await supabase
        //   .from('profiles')
        //   .select('terms_accepted')
        //   .eq('id', session.user.id)
        //   .single();

        // console.log('[Login] Terms accepted:', profile?.terms_accepted);

        // if (!profile?.terms_accepted) {
        //   // User hasn't accepted terms - redirect to terms consent screen
        //   const pendingToken = getPendingInviteToken();
        //   const intendedPath = pendingToken ? `/invite/${encodeURIComponent(pendingToken)}` : '/';

        //   console.log('[Login] 🔄 Redirecting to terms consent, intended path:', intendedPath);
        //   navigate('/terms-consent', { replace: true, state: { from: intendedPath } });
        //   setLoading(false);
        //   return;
        // }

        // User has accepted terms - proceed with normal flow
        const pendingToken = getPendingInviteToken();
        console.log('[Login] getPendingInviteToken() returned:', pendingToken);
        console.log('[Login] localStorage check:', {
          pending_invite_token: localStorage.getItem('pending_invite_token'),
          pending_join_pot_id: localStorage.getItem('pending_join_pot_id'),
          pendingInviteUrl: localStorage.getItem('pendingInviteUrl'),
        });

        if (pendingToken) {
          clearPendingInvite(); // Clear before navigating to prevent re-use
          const targetPath = `/invite/${encodeURIComponent(pendingToken)}`;
          console.log('[Login] 🔄 Navigating to invite page:', targetPath);
          navigate(targetPath, { replace: true });
        } else {
          console.log('[Login] 🔄 No pending invite, navigating to home');
          navigate('/', { replace: true });
        }
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, dismiss, clear]);

  // Fallback check for normal login flow (non-OAuth)
  useEffect(() => {
    if (authLoading || !session || hasProcessedPendingInvite.current) return;

    const checkTermsAndNavigate = async () => {
      hasProcessedPendingInvite.current = true;
      clear();
      dismiss();

      // Clean up auth_active flag after successful login
      localStorage.removeItem('auth_active');

      // Check if user has accepted terms
      // NOTE: terms_accepted column temporarily disabled - add via migration if needed
      // const { data: profile } = await supabase
      //   .from('profiles')
      //   .select('terms_accepted')
      //   .eq('id', session.user.id)
      //   .single();

      // if (!profile?.terms_accepted) {
      //   // User hasn't accepted terms - redirect to terms consent screen
      //   const pendingToken = getPendingInviteToken();
      //   const intendedPath = pendingToken ? `/invite/${encodeURIComponent(pendingToken)}` : '/';

      //   navigate('/terms-consent', { replace: true, state: { from: intendedPath } });
      //   setLoading(false);
      //   return;
      // }

      // User has accepted terms - proceed with normal flow
      // If there is a pending invite token, hand off to /invite/:token so that
      // JoinPot.tsx is the single place that attempts the join and shows any
      // error toast. The login page must never display a join error toast.
      const pendingToken = getPendingInviteToken();
      if (pendingToken) {
        clearPendingInvite(); // Clear before navigating to prevent re-use
        navigate(`/invite/${encodeURIComponent(pendingToken)}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
      setLoading(false);
    };

    checkTermsAndNavigate();
  }, [session, authLoading, navigate, dismiss, clear]);

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

  const getOAuthSuggestionMessage = (lang: string): string => {
    const msgs: Record<string, string> = {
      fr: 'Il semble que vous utilisez Google pour vous connecter. Essayez "Continuer avec Google".',
      en: 'It looks like you use Google to sign in. Try "Continue with Google".',
      de: 'Es scheint, dass Sie Google zum Anmelden verwenden. Versuchen Sie "Mit Google fortfahren".',
      es: 'Parece que usas Google para iniciar sesión. Prueba "Continuar con Google".',
    };
    return msgs[lang] ?? msgs['en'];
  };

  const getInvalidCredentialsMessage = (lang: string): string => {
    const msgs: Record<string, string> = {
      fr: 'Identifiants incorrects. Si vous utilisez Google, cliquez sur "Continuer avec Google".',
      en: 'Incorrect credentials. If you signed up with Google, click "Continue with Google".',
      de: 'Falsche Anmeldedaten. Falls Sie Google verwenden, klicken Sie auf "Mit Google fortfahren".',
      es: 'Credenciales incorrectas. Si te registraste con Google, haz clic en "Continuar con Google".',
    };
    return msgs[lang] ?? msgs['en'];
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setShowUnverified(false);
    setShowOAuthSuggestion(false);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);

      if (error.message.toLowerCase().includes('email not confirmed')) {
        setShowUnverified(true);
        return;
      }

      // Show OAuth suggestion for auth errors
      setShowOAuthSuggestion(true);

      const isInvalidCredentials = error.message.toLowerCase().includes('invalid login credentials');
      toast({
        title: t('auth.loginFailed'),
        description: isInvalidCredentials
          ? getInvalidCredentialsMessage(i18n.language)
          : error.message,
        variant: 'destructive',
      });
      return;
    }

    // Success — clear OAuth suggestion and old lockout data (backwards compat)
    localStorage.removeItem('login_lockout');
    setShowOAuthSuggestion(false);

    if (data.session && !session) {
      hasProcessedPendingInvite.current = false;
    }
  };


  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      {/* Language selector — top right */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-sm">
        {/* Brand logo — above the card */}
        <div className="flex justify-center mb-10">
          <img src="/monto_logo.svg" alt="Monto" style={{ width: 64, height: 64, borderRadius: 16 }} />
        </div>

        {isVerified && (
          <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl px-4 py-3 mb-5 text-sm">
            <CheckCircle2 size={18} className="flex-shrink-0" />
            <span>{t('auth.emailVerified')}</span>
          </div>
        )}

        {showOAuthSuggestion && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-xl px-4 py-3 mb-5 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{getOAuthSuggestionMessage(i18n.language)}</span>
            </div>
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
          <SocialLoginButtons inviteId={inviteParam} />

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" type="email" placeholder={t('auth.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 rounded-xl" />
            </div>
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">{t('auth.forgotPassword')}</Link>
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-xl mt-1"
              disabled={loading}
            >
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          {t('auth.noAccount')}{' '}
          <Link to="/signup" className="text-primary font-semibold hover:underline">{t('auth.createOne')}</Link>
        </p>
      </div>

      <footer className="mt-10 text-center text-xs text-muted-foreground">
        <a
          href="https://montofinance.app/privacy"
          className="hover:text-foreground hover:underline transition-colors"
        >
          {t('auth.privacyPolicy')}
        </a>
      </footer>
    </div>
  );
}