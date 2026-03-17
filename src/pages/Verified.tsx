import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Verified() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-2xl shadow-card border border-border p-8 text-center space-y-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-success/15 mx-auto">
            <CheckCircle2 className="text-success" size={30} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Email verified!</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              You're all set. Head back to Monto and log in to get started.
            </p>
          </div>
          <Button
            onClick={() => navigate('/login')}
            className="w-full h-12 rounded-xl"
          >
            Go to login
          </Button>
        </div>
      </div>
    </div>
  );
}
