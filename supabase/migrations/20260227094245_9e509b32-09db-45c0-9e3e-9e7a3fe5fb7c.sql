ALTER TABLE public.pots ADD COLUMN IF NOT EXISTS max_withdrawal_amount numeric DEFAULT NULL;
ALTER TABLE public.pots ADD COLUMN IF NOT EXISTS max_withdrawals_per_day integer DEFAULT NULL;