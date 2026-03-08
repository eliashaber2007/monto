import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { CoinsPotAnimation, ProgressRingAnimation, BankConnectAnimation } from '@/components/OnboardingAnimations';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
];

export default function Onboarding() {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isTutorial = searchParams.get('tutorial') === 'true';

  const screens = [
    {
      title: t('onboarding.welcome'),
      body: t('onboarding.welcomeBody'),
      Animation: CoinsPotAnimation,
    },
    {
      title: t('onboarding.howItWorks'),
      body: t('onboarding.howItWorksBody'),
      Animation: ProgressRingAnimation,
    },
    {
      title: t('onboarding.connectBank'),
      body: t('onboarding.connectBankBody'),
      Animation: BankConnectAnimation,
    },
  ];

  // step 0 = language picker, steps 1-3 = instruction screens
  const isLanguageStep = step === 0;
  const screenIndex = step - 1;
  const screen = screens[screenIndex];
  const isLast = step === screens.length; // last instruction screen

  const handleLanguageSelect = (code: string) => {
    i18n.changeLanguage(code);
    setStep(1);
  };

  const handleContinue = async () => {
    if (isLast) {
      if (isTutorial) {
        navigate('/profile', { replace: true });
      } else {
        if (user?.id) {
          await supabase.from('profiles').update({ has_seen_onboarding: true } as any).eq('id', user.id);
          queryClient.invalidateQueries({ queryKey: ['profile'] });
        }
        navigate('/', { replace: true });
      }
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-between px-6 py-10">
      {isLanguageStep ? (
        <>
          <div className="flex-1" />
          <div className="text-center max-w-sm mb-8">
            <h1 className="text-2xl font-bold text-white mb-6">{t('onboarding.chooseLanguage')}</h1>
            <div className="grid grid-cols-2 gap-3">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageSelect(lang.code)}
                  className={`flex items-center gap-3 px-5 py-4 rounded-2xl border-2 transition-all text-left ${
                    i18n.language === lang.code
                      ? 'border-primary bg-primary/10'
                      : 'border-white/10 hover:border-white/30 bg-white/5'
                  }`}
                >
                  <span className="text-3xl">{lang.flag}</span>
                  <span className="text-white font-semibold text-sm">{lang.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex justify-center gap-2 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${i === step ? 'bg-primary' : 'bg-white/20'}`}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex-1" />
          <div className="w-full max-w-xs flex justify-center scale-[1.8] mb-8">
            <screen.Animation />
          </div>
          <div className="text-center max-w-sm mb-8">
            <h1 className="text-2xl font-bold text-white mb-3">{screen.title}</h1>
            <p className="text-sm text-white/70 leading-relaxed">{screen.body}</p>
          </div>
          <div className="flex-1" />
          <div className="flex justify-center gap-2 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${i === step ? 'bg-primary' : 'bg-white/20'}`}
              />
            ))}
          </div>
          <button
            onClick={handleContinue}
            className="w-full max-w-sm h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-colors active:scale-[0.98]"
          >
            {isLast ? (isTutorial ? t('common.done') : t('onboarding.getStarted')) : t('common.continue')}
          </button>
        </>
      )}
    </div>
  );
}
