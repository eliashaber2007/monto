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

  useEffect(() => {
    console.log('[AuthContext] Initializing with session persistence');

    // Listen for auth state changes (login/logout events)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[AuthContext] Auth state change:', event, 'hasSession:', !!session, 'path:', window.location.pathname);
        setSession(session);
        setLoading(false);
      }
    );

    // Check if there's a session (from OAuth callback or persisted storage)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log('[AuthContext] Session restored');
        setSession(session);
      } else {
        console.log('[AuthContext] No session - user must login');
        setSession(null);
      }
      setLoading(false);
    });

    // Sign out when user closes tab or navigates away
    // This prevents session from persisting across browser restarts
    const handleBeforeUnload = () => {
      console.log('[AuthContext] Window closing - signing out');
      supabase.auth.signOut();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
