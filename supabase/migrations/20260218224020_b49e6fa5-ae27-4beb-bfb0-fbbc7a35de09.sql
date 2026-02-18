
-- Add receipt-related columns to pots table
ALTER TABLE public.pots
  ADD COLUMN IF NOT EXISTS visual_style text NOT NULL DEFAULT 'liquid_bubble',
  ADD COLUMN IF NOT EXISTS withdrawal_rule text NOT NULL DEFAULT 'auto_approve',
  ADD COLUMN IF NOT EXISTS withdrawal_password text,
  ADD COLUMN IF NOT EXISTS require_receipt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_window_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS goal_amount numeric;

-- Create receipts table for withdrawal receipt uploads
CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pot_id uuid NOT NULL REFERENCES public.pots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  image_url text,
  status text NOT NULL DEFAULT 'pending',  -- pending | submitted | approved | rejected
  submitted_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  reviewer_comment text,
  deadline timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_receipts_pot_id ON public.receipts(pot_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON public.receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_transaction_id ON public.receipts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON public.receipts(status);

-- Enable RLS
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- SELECT: pot members can see receipts in their pot
CREATE POLICY receipts_select_pot_members ON public.receipts
  FOR SELECT
  USING (is_pot_member(pot_id, auth.uid()));

-- INSERT: authenticated members can submit receipts for their own withdrawals
CREATE POLICY receipts_insert_own ON public.receipts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_pot_member(pot_id, auth.uid()));

-- UPDATE: only the pot creator can review (approve/reject) receipts
CREATE POLICY receipts_update_creator ON public.receipts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.pot_members
      WHERE pot_id = receipts.pot_id
        AND user_id = auth.uid()
        AND role = 'creator'
    )
  );

-- Storage bucket for receipt images
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload to their own folder
CREATE POLICY "receipts_upload_own" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage RLS: pot members can view receipts
CREATE POLICY "receipts_view_pot_members" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'receipts' AND auth.uid() IS NOT NULL);
