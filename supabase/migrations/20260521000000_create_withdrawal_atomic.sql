-- Create atomic withdrawal function to prevent race conditions
-- This function checks balance and inserts withdrawal in a single transaction

CREATE OR REPLACE FUNCTION create_withdrawal_atomic(
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
  -- Check pot exists and get balance (locks the row for update)
  SELECT balance INTO v_pot_balance
  FROM pots
  WHERE pots.id = p_pot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pot not found';
  END IF;

  -- Check sufficient balance
  IF p_amount > v_pot_balance THEN
    RAISE EXCEPTION 'Insufficient pot balance';
  END IF;

  -- Insert withdrawal (this will fail if RLS denies it)
  INSERT INTO withdrawals (pot_id, user_id, amount, note, status)
  VALUES (p_pot_id, p_user_id, p_amount, p_note, p_status)
  RETURNING
    withdrawals.id,
    withdrawals.pot_id,
    withdrawals.user_id,
    withdrawals.amount,
    withdrawals.note,
    withdrawals.status,
    withdrawals.created_at,
    withdrawals.updated_at
  INTO
    v_withdrawal_id,
    pot_id,
    user_id,
    amount,
    note,
    status,
    created_at,
    updated_at;

  RETURN NEXT;
END;
$$;

-- Grant execute to authenticated users (RLS on withdrawals table still applies)
GRANT EXECUTE ON FUNCTION create_withdrawal_atomic TO authenticated;
