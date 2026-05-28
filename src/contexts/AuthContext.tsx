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
    console.log('[AuthContext] Initializing - no session persistence, login required every visit');

    // Listen for auth state changes (login/logout events)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[AuthContext] Auth state change:', event, 'hasSession:', !!session, 'path:', window.location.pathname);
        setSession(session);
        setLoading(false);
      }
    );

    // Check if there's a session from OAuth callback (access_token in URL)
    // This is the ONLY way to get a session - no localStorage restoration
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log('[AuthContext] Session detected from OAuth callback');
        setSession(session);
      } else {
        console.log('[AuthContext] No session - user must login');
        setSession(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
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
