-- Add updated_at column to withdrawals table
ALTER TABLE public.withdrawals
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

-- Create auto-updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger on withdrawals table
DROP TRIGGER IF EXISTS update_withdrawals_updated_at ON public.withdrawals;
CREATE TRIGGER update_withdrawals_updated_at
BEFORE UPDATE ON public.withdrawals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create atomic withdrawal function
CREATE OR REPLACE FUNCTION public.create_withdrawal_atomic(
  p_pot_id uuid,
  p_user_id uuid,
  p_amount numeric,
  p_note text,
  p_status text
)
RETURNS TABLE (
  id uuid,
  pot_id uuid,
  user_id uuid,
  amount numeric,
  note text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pot_balance numeric;
  v_withdrawal_id uuid;
BEGIN
  SELECT balance INTO v_pot_balance
  FROM public.pots
  WHERE public.pots.id = p_pot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pot not found';
  END IF;

  IF p_amount > v_pot_balance THEN
    RAISE EXCEPTION 'Insufficient pot balance';
  END IF;

  INSERT INTO public.withdrawals (pot_id, user_id, amount, note, status)
  VALUES (p_pot_id, p_user_id, p_amount, p_note, p_status)
  RETURNING public.withdrawals.id, public.withdrawals.pot_id, public.withdrawals.user_id, public.withdrawals.amount, public.withdrawals.note, public.withdrawals.status, public.withdrawals.created_at, public.withdrawals.updated_at
  INTO v_withdrawal_id, pot_id, user_id, amount, note, status, created_at, updated_at;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_withdrawal_atomic TO authenticated;