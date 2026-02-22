import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DarkModeContextType {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  loading: boolean;
}

const DarkModeContext = createContext<DarkModeContextType>({
  darkMode: false,
  setDarkMode: () => {},
  loading: true,
});

function applyDarkClass(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
}

export function DarkModeProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [darkMode, setDarkModeState] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load preference from DB on auth ready
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      applyDarkClass(false);
      setDarkModeState(false);
      setLoading(false);
      return;
    }

    supabase
      .from('profiles')
      .select('dark_mode')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const isDark = data?.dark_mode ?? false;
        setDarkModeState(isDark);
        applyDarkClass(isDark);
        setLoading(false);
      });
  }, [user, authLoading]);

  const setDarkMode = (value: boolean) => {
    setDarkModeState(value);
    applyDarkClass(value);

    // Persist to DB
    if (user) {
      supabase
        .from('profiles')
        .update({ dark_mode: value } as any)
        .eq('id', user.id)
        .then();
    }
  };

  return (
    <DarkModeContext.Provider value={{ darkMode, setDarkMode, loading }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export const useDarkMode = () => useContext(DarkModeContext);
