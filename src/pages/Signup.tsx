import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Signup() {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: t('auth.passwordTooShort'),
        description: t('auth.passwordTooShortDesc'),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName },
        emailRedirectTo: `${window.location.origin}/login?verified=true`,
      },
    });

    if (error) {
      setLoading(false);
      toast({ title: t('auth.signupFailed'), description: error.message, variant: "destructive" });
      return;
    }

    await supabase.auth.signOut();

    setLoading(false);
    setVerificationSent(true);
  };

  if (verificationSent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-pill">
            <Mail className="text-primary-foreground" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{t('auth.checkInbox')}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t('auth.verificationSent')} <span className="font-semibold text-foreground">{email}</span>{t('auth.clickToActivate')}
          </p>
          <p className="text-center text-sm text-muted-foreground mt-8">
            {t('auth.alreadyVerified')}{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              {t('auth.signIn')}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-pill">
            <span className="text-primary-foreground font-bold text-xl">M</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t('auth.createAccount')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('auth.startSaving')}</p>
        </div>

        <div className="bg-card rounded-2xl shadow-card p-6 border border-border space-y-4">
          <SocialLoginButtons />

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">{t('auth.firstName')}</Label>
              <Input id="firstName" type="text" placeholder="Alex" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input id="password" type="password" placeholder="Min. 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11 rounded-xl" />
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl mt-2" disabled={loading}>
              {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {t('auth.hasAccount')}{" "}
          <Link to="/login" className="text-primary font-semibold hover:underline">{t('auth.signIn')}</Link>
        </p>
      </div>
    </div>
  );
}
