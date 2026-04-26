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
          console.warn('Auth session restoration timed out — forcing reload.');
          window.location.href = '/';
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
          sessionStorage.setItem('auth_active', 'true');
        }
        if (event === 'SIGNED_OUT') {
          sessionStorage.removeItem('auth_active');
        }

        // Handle OAuth redirect: if user just signed in and there's a pending invite URL, redirect
        if (event === 'SIGNED_IN' && session && !hasHandledOAuthRedirect.current) {
          hasHandledOAuthRedirect.current = true;
          const pendingUrl = localStorage.getItem('pendingInviteUrl');
          if (pendingUrl) {
            localStorage.removeItem('pendingInviteUrl');
            localStorage.removeItem('pending_join_pot_id');
            // Validate URL is same origin before redirecting
            if (pendingUrl.startsWith(window.location.origin + '/')) {
              setTimeout(() => {
                window.location.href = pendingUrl;
              }, 0);
            }
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

    const wasExplicitlyLoggedIn = sessionStorage.getItem('auth_active');

    // Detect OAuth redirect using Supabase session check rather than URL string matching
    supabase.auth.getSession().then(({ data: { session } }) => {
      const hasSessionFromOAuth = !!session && (
        window.location.hash.includes('access_token') ||
        window.location.search.includes('code=') ||
        window.location.pathname.includes('~oauth')
      );

      if (!wasExplicitlyLoggedIn && !hasSessionFromOAuth) {
        supabase.auth.signOut().then(() => {
          setSession(null);
          setLoading(false);
          clearTimeout(stuckTimeout);
        });
      } else {
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
