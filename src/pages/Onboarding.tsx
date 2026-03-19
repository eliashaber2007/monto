import { useState, useEffect } from 'react';
import montoLogo from '@/assets/monto-logo.png';
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
    } else {
      if (user?.id) {
        await supabase.from('profiles').update({ has_seen_onboarding: true } as any).eq('id', user.id);
        queryClient.invalidateQueries({ queryKey: ['profile'] });
      }
      navigate('/', { replace: true });
    }
  };

  // Welcome screen (step 0)
  if (isWelcome) {
    return (
      <div className="fixed inset-0 z-50 bg-[#000000] flex flex-col items-center justify-center px-6 py-10">
        <div className="text-center max-w-sm">
          <img src={montoLogo} alt="Monto logo" className="w-20 h-20 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-[#FFFFFF] mb-3">Welcome to Monto 👋</h1>
          <p className="text-base text-[#E5E5E5] leading-relaxed">Your group savings app</p>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setStep(1)}
          className="w-full max-w-sm h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-colors active:scale-[0.98]"
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
