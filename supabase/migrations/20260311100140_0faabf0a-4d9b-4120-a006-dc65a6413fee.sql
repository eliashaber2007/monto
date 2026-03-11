
-- Allow leaders to update withdrawals (approve/reject) for their pot
CREATE POLICY "withdrawals_update_leader"
ON public.withdrawals
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.pot_members pm
    WHERE pm.pot_id = withdrawals.pot_id
    AND pm.user_id = auth.uid()
    AND pm.role = 'leader'
  )
);
