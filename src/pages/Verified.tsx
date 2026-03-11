import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Verified() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Immediately destroy any session Supabase created from the verification link
    supabase.auth.signOut().then(() => {
      sessionStorage.removeItem('auth_active');
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-950/30 mb-4">
          <CheckCircle2 className="text-green-600 dark:text-green-400" size={28} />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Email Verified! ✅</h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">
          Your account has been confirmed. Head back to Monto and log in to get started.
        </p>
        <Button
          onClick={() => navigate('/login')}
          className="w-full h-11 rounded-xl"
        >
          Go to login
        </Button>
      </div>
    </div>
  );
}
