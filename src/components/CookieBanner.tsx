import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

const COOKIE_CONSENT_KEY = 'cookie_consent_accepted';

function getCookieMessage(language: string): string {
  const messages: Record<string, string> = {
    'fr': "Nous utilisons des cookies pour améliorer votre expérience. En continuant, vous acceptez notre utilisation des cookies.",
    'en': "We use cookies to improve your experience. By continuing, you agree to our use of cookies.",
    'de': "Wir verwenden Cookies, um Ihre Erfahrung zu verbessern. Durch die weitere Nutzung stimmen Sie der Verwendung von Cookies zu.",
    'es': "Utilizamos cookies para mejorar tu experiencia. Al continuar, aceptas el uso de cookies.",
  };
  return messages[language] || messages['en'];
}

function getAcceptButtonLabel(language: string): string {
  const labels: Record<string, string> = {
    'fr': "Accepter",
    'en': "Accept",
    'de': "Akzeptieren",
    'es': "Aceptar",
  };
  return labels[language] || labels['en'];
}

export default function CookieBanner() {
  const { i18n } = useTranslation();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const hasAccepted = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!hasAccepted) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    setShowBanner(false);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
        <p className="text-sm text-muted-foreground">
          {getCookieMessage(i18n.language)}
        </p>
        <Button
          onClick={handleAccept}
          className="rounded-lg px-6 py-2 h-auto whitespace-nowrap flex-shrink-0"
        >
          {getAcceptButtonLabel(i18n.language)}
        </Button>
      </div>
    </div>
  );
}
