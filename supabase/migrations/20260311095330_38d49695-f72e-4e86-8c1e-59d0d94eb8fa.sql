
-- Allow pot creators to update pot_members (for leader assignment)
CREATE POLICY "pot_members_update_creator"
ON public.pot_members
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.pots
    WHERE pots.id = pot_members.pot_id
    AND pots.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pots
    WHERE pots.id = pot_members.pot_id
    AND pots.created_by = auth.uid()
  )
);
