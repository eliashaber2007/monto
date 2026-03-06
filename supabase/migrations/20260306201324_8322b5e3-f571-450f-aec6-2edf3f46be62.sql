
-- Create withdrawal_expenses table
CREATE TABLE public.withdrawal_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id uuid NOT NULL REFERENCES public.withdrawals(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  amount numeric NOT NULL,
  receipt_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.withdrawal_expenses ENABLE ROW LEVEL SECURITY;

-- Select: pot members can view expenses (via withdrawal -> pot membership)
CREATE POLICY "withdrawal_expenses_select_pot_members" ON public.withdrawal_expenses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.withdrawals w
      WHERE w.id = withdrawal_expenses.withdrawal_id
      AND is_pot_member(w.pot_id, auth.uid())
    )
  );

-- Insert: only the withdrawal owner can add expenses
CREATE POLICY "withdrawal_expenses_insert_own" ON public.withdrawal_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.withdrawals w
      WHERE w.id = withdrawal_expenses.withdrawal_id
      AND w.user_id = auth.uid()
    )
  );

-- Update: only the withdrawal owner can update expenses
CREATE POLICY "withdrawal_expenses_update_own" ON public.withdrawal_expenses
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.withdrawals w
      WHERE w.id = withdrawal_expenses.withdrawal_id
      AND w.user_id = auth.uid()
    )
  );

-- Delete: only the withdrawal owner can delete expenses
CREATE POLICY "withdrawal_expenses_delete_own" ON public.withdrawal_expenses
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.withdrawals w
      WHERE w.id = withdrawal_expenses.withdrawal_id
      AND w.user_id = auth.uid()
    )
  );
