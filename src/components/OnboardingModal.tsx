import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const screens = [
  {
    title: 'Welcome to Monto',
    body: "Monto gives your group one place to hold shared money. The pot owner stays in control. Members can request what they need, no awkward messages, no chasing anyone down 💸. Every transaction is logged and owners can request receipts to keep things clean ✅.",
  },
  {
    title: 'How it works',
    body: "Create a pot, set a goal amount and share the link 🔗. Everyone contributes at their own pace and the pot owner withdraws when the time is right.",
  },
  {
    title: 'Connect your bank account',
    body: "To receive withdrawals you'll need to connect your bank account first 🏦. It only takes a minute and you can do it anytime from your Profile page.",
  },
];

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
}

export default function OnboardingModal({ open, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const screen = screens[step];
  const isLast = step === screens.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onComplete(); }}>
      <DialogContent className="max-w-sm rounded-2xl p-0 gap-0 [&>button]:hidden">
        <div className="px-6 pt-8 pb-6 text-center">
          <h2 className="text-xl font-bold text-foreground mb-3">{screen.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{screen.body}</p>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-1.5 pb-4">
          {screens.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>

        <div className="px-6 pb-6 space-y-2">
          {isLast ? (
            <>
              <Button
                className="w-full h-11 rounded-xl font-semibold"
                onClick={() => { onComplete(); navigate('/profile'); }}
              >
                Go to Profile
              </Button>
              <button
                onClick={onComplete}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Do it later
              </button>
              <button
                onClick={() => setStep(step - 1)}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Back
              </button>
            </>
          ) : (
            <>
              <Button
                className="w-full h-11 rounded-xl font-semibold"
                onClick={() => setStep(step + 1)}
              >
                Next
              </Button>
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  Back
                </button>
              )}
              <button
                onClick={onComplete}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Skip
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
