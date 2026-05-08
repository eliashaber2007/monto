ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

UPDATE public.profiles
  SET onboarding_completed = true
  WHERE has_seen_onboarding = true AND onboarding_completed = false;