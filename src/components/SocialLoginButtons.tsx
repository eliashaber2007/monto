import { useState } from 'react';
import { lovable } from '@/integrations/lovable/index';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export default function SocialLoginButtons() {
  const { t } = useTranslation();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingApple, setLoadingApple] = useState(false);
  const { toast } = useToast();

  const handleGoogle = async () => {
    setLoadingGoogle(true);
    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ title: t('auth.googleSignInFailed'), description: String(error), variant: 'destructive' });
      setLoadingGoogle(false);
    }
  };

  const handleApple = async () => {
    setLoadingApple(true);
    const { error } = await lovable.auth.signInWithOAuth('apple', {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ title: t('auth.appleSignInFailed'), description: String(error), variant: 'destructive' });
      setLoadingApple(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={handleGoogle}
        disabled={loadingGoogle}
        className="w-full h-11 rounded-xl border border-border bg-white text-gray-700 font-medium flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
          <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        {loadingGoogle ? t('auth.connecting') : t('auth.continueWithGoogle')}
      </button>

      <button
        onClick={handleApple}
        disabled={loadingApple}
        className="w-full h-11 rounded-xl bg-black text-white font-medium flex items-center justify-center gap-3 hover:bg-gray-900 transition-colors disabled:opacity-50"
      >
        <svg width="16" height="18" viewBox="0 0 16 18" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M13.036 9.51c-.02-2.11 1.724-3.122 1.803-3.172-0.982-1.434-2.51-1.63-3.053-1.653-1.3-.132-2.538.765-3.198.765-.659 0-1.68-.746-2.76-.726-1.42.02-2.73.826-3.462 2.098-1.476 2.562-.378 6.357 1.061 8.436.704 1.017 1.543 2.16 2.645 2.12 1.061-.043 1.462-.687 2.745-.687 1.283 0 1.643.687 2.765.665 1.142-.02 1.862-1.036 2.562-2.057.808-1.18 1.14-2.323 1.16-2.382-.025-.011-2.226-.854-2.248-3.387zM10.92 3.12c.585-.71.98-1.695.872-2.677-.843.034-1.864.562-2.468 1.27-.542.628-1.017 1.63-.89 2.593.94.073 1.9-.478 2.486-1.186z"/>
        </svg>
        {loadingApple ? t('auth.connecting') : t('auth.continueWithApple')}
      </button>

      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">{t('auth.orContinueWithEmail')}</span>
        <div className="flex-1 h-px bg-border" />
      </div>
    </div>
  );
}
