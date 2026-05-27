import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Users, Droplets } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { joinPotFromInviteToken, savePendingInviteToken, withTimeout, clearPendingInvite } from '@/lib/inviteJoin';

const PENDING_JOIN_KEY = 'pending_join_pot_id';
const PENDING_INVITE_URL_KEY = 'pendingInviteUrl';

export function getPendingJoinPotId(): string | null {
  return localStorage.getItem(PENDING_JOIN_KEY);
}

export function clearPendingJoinPotId() {
  localStorage.removeItem(PENDING_JOIN_KEY);
}

export function getPendingInviteUrl(): string | null {
  return localStorage.getItem(PENDING_INVITE_URL_KEY);
}

export function clearPendingInviteUrl() {
  localStorage.removeItem(PENDING_INVITE_URL_KEY);
}

export default function JoinPot() {
  const { t } = useTranslation();
  const { potId } = useParams<{ potId: string }>();
  const navigate = useNavigate();
  const { session, user, loading: authLoading } = useAuth();
  const { toast, dismiss, clear } = useToast();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const attemptedRef = useRef<string | null>(null);
  const previousSessionRef = useRef<typeof session>(null);

  useLayoutEffect(() => {
    clear();
    dismiss();
    setErrorMessage(null);
  }, [clear, dismiss]);

  useEffect(() => {
    clear();
    dismiss();
    setErrorMessage(null);

    // Wait for auth to fully load before making any decisions
    if (authLoading) return;

    // Detect OAuth callback: session changed from null to non-null (user just logged in)
    if (!previousSessionRef.current && session) {
      console.log('[JoinPot] OAuth callback detected, resetting attempt ref');
      attemptedRef.current = null;
    }
    previousSessionRef.current = session;

    // Check session instead of just user to ensure auth is fully confirmed
    if (!session || !user) {
      if (potId) {
        savePendingInviteToken(potId);
      }
      navigate('/login', { replace: true });
      return;
    }

    if (!potId) return;

    // Guard against duplicate runs (StrictMode / re-renders) which previously
    // caused a stale "Error joining pot" toast to flash before success.
    if (attemptedRef.current === potId) return;
    attemptedRef.current = potId;

    const joinPot = async () => {
      const timeoutMessage = t('joinPot.timeout');

      try {
        const result = await withTimeout(
          joinPotFromInviteToken(potId, user.id),
          15000,
          timeoutMessage
        );
        console.log('[JoinPot] join result', result, 'potName:', result.potName);
        navigate(`/pots/${result.potId}`, { replace: true });
      } catch (err: any) {
        const description = err?.message === timeoutMessage ? timeoutMessage : t('joinPot.errorDescription');
        setErrorMessage(description);
        setTimeout(() => {
          toast({ title: t('joinPot.error'), description, variant: 'destructive' });
        }, 0);
      } finally {
        clearPendingInvite();
      }
    };

    const timer = setTimeout(() => { joinPot(); }, 500);
    return () => clearTimeout(timer);
  }, [session, user, authLoading, potId, navigate, toast, dismiss, clear, t]);

  const handleRetry = () => {
    setErrorMessage(null);
    attemptedRef.current = null;
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-card rounded-2xl border border-border p-10 text-center max-w-sm w-full shadow-lg">
        {errorMessage ? (
          <>
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-5">
              <Users size={28} className="text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">{t('joinPot.error')}</h1>
            <p className="text-sm text-muted-foreground mb-6">{errorMessage}</p>
            <div className="space-y-2">
              <button
                onClick={handleRetry}
                className="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                {t('common.retry') || 'Retry'}
              </button>
              <button
                onClick={() => navigate('/', { replace: true })}
                className="w-full px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground font-semibold text-sm hover:bg-secondary/80 transition-colors"
              >
                {t('common.returnHome')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="relative w-24 h-24 mx-auto mb-8">
              {/* Animated ring spinner */}
              <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />

              {/* Monto monogram */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-bold text-primary">M</span>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-3 tracking-tight">{t('joinPot.joining')}</h1>
            <p className="text-sm text-muted-foreground/80 font-medium">
              Veuillez patienter...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
