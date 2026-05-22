import { useState, useEffect } from 'react';
import montoLogo from '@/assets/monto_logo.svg';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { CoinsPotAnimation, ProgressRingAnimation, BankConnectAnimation } from '@/components/OnboardingAnimations';
import { useTranslation } from 'react-i18next';

export default function Onboarding() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [buttonsReady, setButtonsReady] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isTutorial = searchParams.get('tutorial') === 'true';

  const isWelcome = step === 0;

  // Reset button delay when step changes (only for instruction screens)
  useEffect(() => {
    if (isWelcome) {
      setButtonsReady(true);
      return;
    }

    // No delay on the last instruction screen - make "Get started" immediately clickable
    const isLastScreen = step === instructionScreens.length;
    if (isLastScreen) {
      setButtonsReady(true);
      return;
    }

    setButtonsReady(false);
    const timer = setTimeout(() => setButtonsReady(true), 4000);
    return () => clearTimeout(timer);
  }, [step, isWelcome]);

  const instructionScreens = [
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

  const isLastInstruction = step === instructionScreens.length;
  const instructionIndex = step - 1;
  const instructionScreen = instructionScreens[instructionIndex];

  const handleFinish = async () => {
    if (isTutorial) {
      navigate('/profile', { replace: true });
      return;
    }
    if (user?.id) {
      const { error, data } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true, has_seen_onboarding: true })
        .eq('id', user.id)
        .select();
      if (error) {
        console.error('[onboarding] failed to persist onboarding_completed', error);
        // Don't navigate — leave user on onboarding so the flag isn't lost.
        return;
      }

      console.log('[onboarding] successfully updated profile:', data);

      // Manually update cache to avoid stale data race condition
      queryClient.setQueryData(['profile', user.id], (old: any) => ({
        ...old,
        onboarding_completed: true,
        has_seen_onboarding: true,
      }));
    }
    navigate('/', { replace: true });
  };

  // Welcome screen (step 0)
  if (isWelcome) {
    return (
      <div className="fixed inset-0 z-50 bg-[#000000] flex flex-col items-center px-6 py-10">
        <div className="flex-1" />
        {/* Logo */}
        <img
          src={montoLogo}
          alt="Monto"
          className="w-24 h-24 rounded-2xl mb-10 animate-[onboard-logo-in_500ms_ease-out_both] onboarding-logo-pulse"
          style={{ boxShadow: '0 0 40px rgba(37, 99, 235, 0.4)' }}
        />
        {/* Text */}
        <div className="text-center max-w-sm">
          <h1
            className="text-2xl font-bold text-[#FFFFFF] mb-3 animate-[onboard-slide-up_400ms_ease-out_200ms_both]"
          >
            {t('onboarding.welcomeTitle')}
          </h1>
          <p
            className="text-base text-[#E5E5E5] leading-relaxed animate-[onboard-fade_400ms_ease-out_400ms_both]"
          >
            {t('onboarding.welcomeSubtitle')}
          </p>
        </div>
        <div className="flex-[2]" />
        <button
          onClick={() => setStep(1)}
          className="w-full max-w-sm h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-colors active:scale-[0.98] animate-[onboard-fade_400ms_ease-out_600ms_both]"
        >
          {t('onboarding.getStarted')}
        </button>
      </div>
    );
  }

  // Instruction screens (steps 1, 2, 3)
  const isLastScreen = instructionIndex === instructionScreens.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-[#000000] flex flex-col items-center justify-between px-6 py-10">
      <div className="flex-1" />
      <div className="w-full max-w-xs flex justify-center scale-[1.8] mb-8">
        <instructionScreen.Animation />
      </div>
      <div className="text-center max-w-sm mb-8">
        <h1 className="text-2xl font-bold text-[#FFFFFF] mb-3">{instructionScreen.title}</h1>
        <p className="text-sm text-[#E5E5E5] leading-relaxed">{instructionScreen.body}</p>
      </div>
      <div className="flex-1" />
      <div className="flex justify-center gap-2 mb-6">
        {instructionScreens.map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${i === instructionIndex ? 'bg-primary' : 'bg-white/20'}`}
          />
        ))}
      </div>
      <div
        className={`w-full max-w-sm flex gap-3 transition-opacity duration-500 ${buttonsReady ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {instructionIndex > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="flex-1 h-14 rounded-2xl border border-white/20 text-[#FFFFFF] font-semibold text-base hover:bg-white/10 transition-colors active:scale-[0.98]"
          >
            {t('common.back')}
          </button>
        )}
        <button
          onClick={isLastScreen ? handleFinish : () => setStep(step + 1)}
          className="flex-1 h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-colors active:scale-[0.98]"
        >
          {isLastScreen ? (isTutorial ? t('common.done') : t('onboarding.getStarted')) : t('common.next')}
        </button>
      </div>
    </div>
  );
}
