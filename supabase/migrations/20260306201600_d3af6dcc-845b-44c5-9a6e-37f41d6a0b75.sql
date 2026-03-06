
-- Drop existing policies
DROP POLICY IF EXISTS "withdrawal_expenses_select_pot_members" ON public.withdrawal_expenses;
DROP POLICY IF EXISTS "withdrawal_expenses_insert_own" ON public.withdrawal_expenses;
DROP POLICY IF EXISTS "withdrawal_expenses_update_own" ON public.withdrawal_expenses;
DROP POLICY IF EXISTS "withdrawal_expenses_delete_own" ON public.withdrawal_expenses;

-- Add user_id column
ALTER TABLE public.withdrawal_expenses
  ADD COLUMN user_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Remove the default after adding
ALTER TABLE public.withdrawal_expenses ALTER COLUMN user_id DROP DEFAULT;

-- Create new policies per user spec
CREATE POLICY "expenses_select_pot_members" ON public.withdrawal_expenses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "expenses_insert_own" ON public.withdrawal_expenses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
