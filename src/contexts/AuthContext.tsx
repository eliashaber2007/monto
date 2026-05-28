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

          // Don't redirect away from /invite page (user may be mid-OAuth flow)
          const isOnInvitePage = window.location.pathname.startsWith('/invite/');

          if (isOnInvitePage) {
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
        console.log('[AuthContext] Auth state change:', event, 'hasSession:', !!session, 'path:', window.location.pathname);
        setSession(session);
        setLoading(false);
        clearTimeout(stuckTimeout);

        if (event === 'SIGNED_IN') {
          // Mark session as explicitly created (email/password login)
          localStorage.setItem('auth_active', 'true');
        }
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem('auth_active');
        }
      }
    );

    const wasExplicitlyLoggedIn = localStorage.getItem('auth_active');

    // Capture URL signals BEFORE Supabase strips them via detectSessionInUrl
    const initialHash = window.location.hash;
    const initialSearch = window.location.search;
    const initialPath = window.location.pathname;

    // Check if this is a recovery flow (password reset)
    const isRecoveryFlow =
      initialPath === '/reset-password' ||
      initialHash.includes('type=recovery') ||
      initialSearch.includes('type=recovery');

    // Check if on invite page (OAuth redirect lands here with potId in URL)
    const isOnInvitePage = initialPath.startsWith('/invite/');

    // Detect OAuth redirect using Supabase session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      const hasSessionFromOAuth = !!session && (
        initialHash.includes('access_token') ||
        initialSearch.includes('code=')
      );

      // Don't clear session if: explicitly logged in, OAuth callback, recovery flow, or on invite page
      const shouldPreserveSession = wasExplicitlyLoggedIn || hasSessionFromOAuth || isRecoveryFlow || isOnInvitePage;

      if (!shouldPreserveSession) {
        console.log('[AuthContext] No active auth signal, clearing session');
        supabase.auth.signOut().then(() => {
          setSession(null);
          setLoading(false);
          clearTimeout(stuckTimeout);
        });
      } else {
        console.log('[AuthContext] Preserving session:', {
          wasExplicitlyLoggedIn: !!wasExplicitlyLoggedIn,
          hasSessionFromOAuth,
          isRecoveryFlow,
          isOnInvitePage,
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
