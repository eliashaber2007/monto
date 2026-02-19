
-- Add Stripe Connect columns to profiles
ALTER TABLE public.profiles
ADD COLUMN stripe_account_id text,
ADD COLUMN stripe_onboarding_complete boolean NOT NULL DEFAULT false;
