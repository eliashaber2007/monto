import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Shield, CreditCard, Lock, FileText } from 'lucide-react';

export default function TermsConsent() {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  // Get the intended destination from location state (set during login redirect)
  const intendedPath = (location.state as any)?.from || '/';

  const handleContinue = async () => {
    if (!user) {
      toast({
        title: 'Erreur',
        description: 'Utilisateur non connecté',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          // NOTE: terms_accepted column temporarily disabled - add via migration if needed
          // terms_accepted: true,
          // terms_accepted_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      // Navigate to intended destination
      navigate(intendedPath, { replace: true });
    } catch (err: any) {
      setLoading(false);
      toast({
        title: 'Erreur',
        description: err.message || 'Impossible de sauvegarder votre consentement',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Bienvenue sur Monto</h1>
          <p className="text-muted-foreground">
            Avant de commencer, veuillez lire et accepter nos conditions
          </p>
        </div>

        {/* Main card */}
        <div className="bg-card rounded-2xl shadow-card p-8 border border-border space-y-6">
          {/* What we collect section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Shield className="text-primary" size={24} />
              Vos données
            </h2>
            <div className="text-sm text-muted-foreground space-y-2 pl-8">
              <p>
                Pour utiliser Monto, nous collectons et stockons les informations suivantes :
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Votre nom et adresse email (fournis lors de l'inscription)</li>
                <li>Vos informations de profil (photo, préférences)</li>
                <li>L'historique de vos contributions aux cagnottes</li>
              </ul>
            </div>
          </div>

          {/* Stripe section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="text-primary" size={24} />
              Paiements sécurisés
            </h2>
            <div className="text-sm text-muted-foreground space-y-2 pl-8">
              <p>
                Tous les paiements sont traités de manière sécurisée par{' '}
                <strong className="text-foreground">Stripe</strong>, notre partenaire de confiance.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Vos informations bancaires ne sont jamais stockées sur nos serveurs</li>
                <li>Stripe est certifié PCI DSS niveau 1 (plus haut niveau de sécurité)</li>
                <li>Toutes les transactions sont cryptées de bout en bout</li>
              </ul>
            </div>
          </div>

          {/* Privacy section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Lock className="text-primary" size={24} />
              Protection de vos données
            </h2>
            <div className="text-sm text-muted-foreground space-y-2 pl-8">
              <p>
                Nous prenons la protection de vos données très au sérieux :
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Vos données ne sont jamais vendues à des tiers</li>
                <li>Vous pouvez à tout moment demander l'export ou la suppression de vos données</li>
                <li>Nous respectons le RGPD (Règlement Général sur la Protection des Données)</li>
              </ul>
            </div>
          </div>

          {/* Links to full documents */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText size={18} className="text-primary" />
              <span>Pour plus d'informations, consultez :</span>
            </div>
            <div className="flex flex-wrap gap-4 pl-7">
              <a
                href="https://montofinance.app/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline font-medium"
              >
                Politique de confidentialité →
              </a>
              <a
                href="https://montofinance.app/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline font-medium"
              >
                Conditions d'utilisation →
              </a>
            </div>
          </div>

          {/* Consent checkbox */}
          <div className="pt-4 border-t border-border">
            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox
                id="terms-checkbox"
                checked={accepted}
                onCheckedChange={(checked) => setAccepted(checked === true)}
                className="mt-1"
              />
              <span className="text-sm text-foreground leading-relaxed group-hover:text-primary transition-colors">
                J'accepte les conditions d'utilisation et la politique de confidentialité de Monto.
                Je comprends que mes données seront traitées conformément à ces documents.
              </span>
            </label>
          </div>

          {/* Continue button */}
          <Button
            onClick={handleContinue}
            disabled={!accepted || loading}
            className="w-full h-12 text-base font-semibold"
          >
            {loading ? 'Enregistrement...' : 'Continuer'}
          </Button>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          En continuant, vous confirmez avoir lu et accepté nos conditions
        </p>
      </div>
    </div>
  );
}
