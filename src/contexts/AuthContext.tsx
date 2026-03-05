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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);

        if (event === 'SIGNED_IN') {
          // Mark that user explicitly logged in during this browser tab session
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
            setTimeout(() => {
              window.location.href = pendingUrl;
            }, 0);
          }
        }
      }
    );

    // If no explicit login happened in this tab, clear any persisted session
    const wasExplicitlyLoggedIn = sessionStorage.getItem('auth_active');
    if (!wasExplicitlyLoggedIn) {
      supabase.auth.signOut().then(() => {
        setSession(null);
        setLoading(false);
      });
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
      });
    }

    return () => subscription.unsubscribe();
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
