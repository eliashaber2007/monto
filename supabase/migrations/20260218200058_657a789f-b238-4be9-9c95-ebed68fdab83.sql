
-- Helper RPC for atomic balance increment (used by stripe-webhook)
CREATE OR REPLACE FUNCTION public.increment_pot_balance(p_pot_id UUID, p_amount NUMERIC)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.pots
  SET balance = balance + p_amount
  WHERE id = p_pot_id;
$$;
