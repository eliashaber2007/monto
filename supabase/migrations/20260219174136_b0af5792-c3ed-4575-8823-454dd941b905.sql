-- Add status column to pots for close pot feature
ALTER TABLE public.pots ADD COLUMN status text NOT NULL DEFAULT 'active';

-- Allow members to delete their own pot_members row (leave pot)
CREATE POLICY "Members can leave pots"
ON public.pot_members
FOR DELETE
USING (auth.uid() = user_id);
