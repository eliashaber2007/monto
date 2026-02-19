
-- 1. Create the handle_new_user trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. Create notify_member_joined trigger
CREATE OR REPLACE TRIGGER on_pot_member_joined
  AFTER INSERT ON public.pot_members
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_member_joined();

-- 3. Create notify_receipt_uploaded trigger
CREATE OR REPLACE TRIGGER on_receipt_uploaded
  AFTER INSERT OR UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_receipt_uploaded();

-- 4. Create withdrawals table
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pot_id UUID NOT NULL REFERENCES public.pots(id),
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on withdrawals
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Withdrawals: members can view withdrawals for their pots
CREATE POLICY "withdrawals_select_pot_members"
  ON public.withdrawals FOR SELECT
  USING (public.is_pot_member(pot_id, auth.uid()));

-- Withdrawals: authenticated users can insert their own
CREATE POLICY "withdrawals_insert_own"
  ON public.withdrawals FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_pot_member(pot_id, auth.uid()));

-- Withdrawals: pot creator can update (approve/reject)
CREATE POLICY "withdrawals_update_creator"
  ON public.withdrawals FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.pots WHERE id = pot_id AND created_by = auth.uid()
  ));
