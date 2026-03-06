ALTER TABLE public.profiles ADD COLUMN has_seen_onboarding boolean NOT NULL DEFAULT false;
UPDATE public.profiles SET has_seen_onboarding = true WHERE has_logged_in_before = true;