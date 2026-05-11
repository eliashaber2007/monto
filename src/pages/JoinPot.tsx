import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Users } from 'lucide-react';
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
  const { user, loading: authLoading } = useAuth();
  const { toast, dismiss, clear } = useToast();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const attemptedRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    clear();
    dismiss();
    setErrorMessage(null);
  }, [clear, dismiss]);

  useEffect(() => {
    clear();
    dismiss();
    setErrorMessage(null);

    if (authLoading) return;

    if (!user) {
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
          5000,
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
      }
    };

    joinPot();
  }, [user, authLoading, potId, navigate, toast, dismiss, clear, t]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-card rounded-2xl border border-border p-10 text-center max-w-sm w-full shadow-sm">
        <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-5">
          <Users size={28} className="text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">{errorMessage ? t('joinPot.error') : t('joinPot.joining')}</h1>
        {errorMessage ? (
          <>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="mt-5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              {t('common.returnHome')}
            </button>
          </>
        ) : (
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mt-4" />
        )}
      </div>
    </div>
  );
}
