import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { CoinsPotAnimation, ProgressRingAnimation, BankConnectAnimation } from '@/components/OnboardingAnimations';

const screens = [
  {
    title: 'Welcome to Monto',
    body: "Monto gives your group one place to hold shared money. The pot owner stays in control. Members can request what they need, no awkward messages, no chasing anyone down 💸. Every transaction is logged and owners can request receipts to keep things clean ✅.",
    Animation: CoinsPotAnimation,
  },
  {
    title: 'How it works',
    body: "Create a pot, set a goal amount and share the link 🔗. Everyone contributes at their own pace and the pot owner withdraws when the time is right.",
    Animation: ProgressRingAnimation,
  },
  {
    title: 'Connect your bank account',
    body: "To receive withdrawals you'll need to connect your bank account first 🏦. It only takes a minute and you can do it anytime from your Profile page.",
    Animation: BankConnectAnimation,
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const screen = screens[step];
  const isLast = step === screens.length - 1;
  const isTutorial = searchParams.get('tutorial') === 'true';

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
      {/* Top spacer */}
      <div className="flex-1" />

      {/* Animation */}
      <div className="w-full max-w-xs flex justify-center scale-[1.8] mb-8">
        <screen.Animation />
      </div>

      {/* Text */}
      <div className="text-center max-w-sm mb-8">
        <h1 className="text-2xl font-bold text-white mb-3">{screen.title}</h1>
        <p className="text-sm text-white/70 leading-relaxed">{screen.body}</p>
      </div>

      {/* Bottom spacer */}
      <div className="flex-1" />

      {/* Dots */}
      <div className="flex justify-center gap-2 mb-6">
        {screens.map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${i === step ? 'bg-primary' : 'bg-white/20'}`}
          />
        ))}
      </div>

      {/* Button */}
      <button
        onClick={handleContinue}
        className="w-full max-w-sm h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-colors active:scale-[0.98]"
      >
        {isLast ? (isTutorial ? 'Done' : 'Get started') : 'Continue'}
      </button>
    </div>
  );
}
