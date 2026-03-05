-- Add peak_balance column to track highest balance ever reached
ALTER TABLE public.pots ADD COLUMN peak_balance numeric NOT NULL DEFAULT 0;

-- Initialize peak_balance to current balance for existing pots
UPDATE public.pots SET peak_balance = balance WHERE balance > 0;

-- Trigger to auto-update peak_balance when balance increases
CREATE OR REPLACE FUNCTION public.update_peak_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.balance > OLD.peak_balance THEN
    NEW.peak_balance := NEW.balance;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_peak_balance
  BEFORE UPDATE ON public.pots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_peak_balance();