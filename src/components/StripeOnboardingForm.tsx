import { useState, useRef, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, ChevronRight, Landmark, User, MapPin, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const stripePromise = loadStripe('pk_live_51T2Gxs93UcBwidVzOU6aoSS85l9pjQEyibOLlypFQ62sCExFP4FIVbYBKGJEqlXEJUKgqk9Zi2hShMw6ARjhjaPv00ZfanO1hO');

const COUNTRIES = [
  { code: 'FR', label: 'France' },
  { code: 'IE', label: 'Ireland' },
  { code: 'DE', label: 'Germany' },
  { code: 'ES', label: 'Spain' },
  { code: 'IT', label: 'Italy' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'BE', label: 'Belgium' },
  { code: 'AT', label: 'Austria' },
  { code: 'PT', label: 'Portugal' },
  { code: 'FI', label: 'Finland' },
  { code: 'LU', label: 'Luxembourg' },
];

interface Props {
  onComplete: () => void;
  onCancel: () => void;
  mode?: 'connect' | 'update';
}

export default function StripeOnboardingForm({ onComplete, onCancel, mode = 'connect' }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');

  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('FR');

  const [iban, setIban] = useState('');

  const totalSteps = 3;

  const canGoNext = () => {
    if (step === 1) return firstName.trim() && lastName.trim() && dobDay && dobMonth && dobYear;
    if (step === 2) return line1.trim() && city.trim() && postalCode.trim() && country;
    if (step === 3) return iban.trim().length >= 15;
    return false;
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);

    try {
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Failed to load payment processor');

      const { token: accountToken, error: tokenError } = await stripe.createToken('account' as any, {
        business_type: 'individual',
        individual: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          dob: {
            day: parseInt(dobDay),
            month: parseInt(dobMonth),
            year: parseInt(dobYear),
          },
          address: {
            line1: line1.trim(),
            city: city.trim(),
            postal_code: postalCode.trim(),
            country,
          },
        },
        tos_shown_and_accepted: true,
      } as any);

      if (tokenError) throw new Error(tokenError.message);
      if (!accountToken) throw new Error('Failed to create account token');

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-connect-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            account_token: accountToken.id,
            iban: iban.trim().replace(/\s/g, ''),
            country,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Onboarding failed');

      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      toast({ title: mode === 'update' ? t('profile.bankUpdated') : t('profile.bankConnectedSuccess') });
      onComplete();
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const stepIcons = [User, MapPin, CreditCard];
  const stepLabels = [t('stripeOnboarding.personalDetails'), t('stripeOnboarding.homeAddress'), t('stripeOnboarding.bankAccount')];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between mb-2">
        {[1, 2, 3].map((s) => {
          const Icon = stepIcons[s - 1];
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                s <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                <Icon size={14} />
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${s <= step ? 'text-foreground' : 'text-muted-foreground'}`}>
                {stepLabels[s - 1]}
              </span>
              {s < 3 && <div className={`w-6 h-0.5 ${s < step ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ob-fn">{t('stripeOnboarding.firstName')}</Label>
            <Input id="ob-fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ob-ln">{t('stripeOnboarding.lastName')}</Label>
            <Input id="ob-ln" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>{t('stripeOnboarding.dateOfBirth')}</Label>
            <div className="flex gap-2">
              <Input type="number" placeholder="DD" min="1" max="31" value={dobDay} onChange={(e) => setDobDay(e.target.value)} className="h-11 rounded-xl flex-1" />
              <Input type="number" placeholder="MM" min="1" max="12" value={dobMonth} onChange={(e) => setDobMonth(e.target.value)} className="h-11 rounded-xl flex-1" />
              <Input type="number" placeholder="YYYY" min="1900" max="2010" value={dobYear} onChange={(e) => setDobYear(e.target.value)} className="h-11 rounded-xl flex-[1.5]" />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ob-line1">{t('stripeOnboarding.streetAddress')}</Label>
            <Input id="ob-line1" value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="123 Main St" className="h-11 rounded-xl" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="ob-city">{t('stripeOnboarding.city')}</Label>
              <Input id="ob-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Paris" className="h-11 rounded-xl" />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="ob-postcode">{t('stripeOnboarding.postcode')}</Label>
              <Input id="ob-postcode" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="75001" className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('stripeOnboarding.country')}</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ob-iban">{t('stripeOnboarding.iban')}</Label>
            <Input
              id="ob-iban"
              value={iban}
              onChange={(e) => setIban(e.target.value.toUpperCase())}
              placeholder="FR76 3000 6000 0112 3456 7890 189"
              className="h-11 rounded-xl font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">{t('stripeOnboarding.ibanSecure')}</p>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          className="flex-1 h-11 rounded-xl"
          onClick={() => step === 1 ? onCancel() : setStep(step - 1)}
        >
          <ChevronLeft size={16} className="mr-1" />
          {step === 1 ? t('common.cancel') : t('common.back')}
        </Button>
        {step < totalSteps ? (
          <Button
            className="flex-1 h-11 rounded-xl"
            disabled={!canGoNext()}
            onClick={() => setStep(step + 1)}
          >
            {t('common.next')}
            <ChevronRight size={16} className="ml-1" />
          </Button>
        ) : (
          <Button
            className="flex-1 h-11 rounded-xl"
            disabled={!canGoNext() || submitting}
            onClick={handleSubmit}
          >
            <Landmark size={15} className="mr-1.5" />
            {submitting
              ? (mode === 'update' ? t('stripeOnboarding.updatingBank') : t('stripeOnboarding.connecting'))
              : (mode === 'update' ? t('stripeOnboarding.updateBank') : t('stripeOnboarding.connectBank'))}
          </Button>
        )}
      </div>
    </div>
  );
}
