import { useState, useEffect, createContext, useContext, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const hasHandledOAuthRedirect = useRef(false);

  useEffect(() => {
    // Safety net: if auth restoration takes too long (e.g. after Stripe redirect),
    // force the app out of the loading state to avoid an infinite spinner.
    const stuckTimeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('[AuthContext] ⚠️ Auth session restoration timed out after 3s');
          console.warn('[AuthContext] Current path:', window.location.pathname);
          console.warn('[AuthContext] Has pending invite:', !!localStorage.getItem('pending_invite_token'));

          // Don't redirect away from /invite if there's a pending invite
          const isOnInvitePage = window.location.pathname.startsWith('/invite/');
          const hasPendingInvite = !!localStorage.getItem('pending_invite_token');

          if (isOnInvitePage && hasPendingInvite) {
            console.warn('[AuthContext] Staying on invite page despite timeout');
            setLoading(false);
          } else {
            console.warn('[AuthContext] Redirecting to home');
            window.location.href = '/';
          }
        }
        return prev;
      });
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);
        clearTimeout(stuckTimeout);

        if (event === 'SIGNED_IN') {
          localStorage.setItem('auth_active', 'true');
        }
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem('auth_active');
        }

        // For OAuth redirects, send the user back to Login so it can process
        // the pending invite with timeout/error handling before navigating.
        if (event === 'SIGNED_IN' && session && !hasHandledOAuthRedirect.current) {
          hasHandledOAuthRedirect.current = true;
          const hasPendingInvite =
            !!localStorage.getItem('pending_invite_token') ||
            !!localStorage.getItem('pendingInviteUrl') ||
            !!localStorage.getItem('pending_join_pot_id');
          if (hasPendingInvite && window.location.pathname !== '/login') {
            setTimeout(() => {
              window.location.href = '/login';
            }, 0);
          }
        }
      }
    );

    // Use Supabase's built-in session detection instead of fragile string matching
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        hasHandledOAuthRedirect.current = false;
      }
    });

    const wasExplicitlyLoggedIn = localStorage.getItem('auth_active');

    // Capture URL signals BEFORE Supabase strips them via detectSessionInUrl
    const initialHash = window.location.hash;
    const initialSearch = window.location.search;
    const initialPath = window.location.pathname;
    const isRecoveryFlow =
      initialPath === '/reset-password' ||
      initialHash.includes('type=recovery') ||
      initialSearch.includes('type=recovery');

    // Check for pending invite as a signal that OAuth is in progress
    const hasPendingInvite =
      !!localStorage.getItem('pending_invite_token') ||
      !!localStorage.getItem('pending_join_pot_id') ||
      !!localStorage.getItem('pendingInviteUrl');

    // Detect OAuth redirect using Supabase session check rather than URL string matching
    supabase.auth.getSession().then(({ data: { session } }) => {
      const hasPendingInvite =
        !!localStorage.getItem('pending_invite_token') ||
        !!localStorage.getItem('pendingInviteUrl') ||
        !!localStorage.getItem('pending_join_pot_id');
      const hasSessionFromOAuth = !!session && (
        initialHash.includes('access_token') ||
        initialSearch.includes('code=') ||
        initialPath.includes('~oauth') ||
        hasPendingInvite
      );

      // Don't clear session if there's a pending invite (OAuth in progress)
      if (!wasExplicitlyLoggedIn && !hasSessionFromOAuth && !isRecoveryFlow && !hasPendingInvite) {
        console.log('[AuthContext] Clearing session: no auth_active, no OAuth, no recovery, no pending invite');
        supabase.auth.signOut().then(() => {
          setSession(null);
          setLoading(false);
          clearTimeout(stuckTimeout);
        });
      } else {
        console.log('[AuthContext] Keeping session:', {
          wasExplicitlyLoggedIn: !!wasExplicitlyLoggedIn,
          hasSessionFromOAuth,
          isRecoveryFlow,
          hasPendingInvite,
        });
        setSession(session);
        setLoading(false);
        clearTimeout(stuckTimeout);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(stuckTimeout);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
