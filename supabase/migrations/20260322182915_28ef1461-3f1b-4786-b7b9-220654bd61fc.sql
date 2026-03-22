-- Allow pot creator to delete pot members (remove members)
CREATE POLICY "Creator can remove pot members"
ON public.pot_members
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.pots
    WHERE pots.id = pot_members.pot_id
    AND pots.created_by = auth.uid()
  )
  AND pot_members.user_id != auth.uid()
);

-- Create a function to notify removed members (bypasses RLS on notifications)
CREATE OR REPLACE FUNCTION public.notify_member_removed(
  p_user_id uuid,
  p_pot_id uuid,
  p_pot_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, pot_id, type, message, variables)
  VALUES (
    p_user_id,
    p_pot_id,
    'member_removed',
    'You have been removed from ' || p_pot_name || ' by the creator.',
    jsonb_build_object('pot', p_pot_name)
  );
END;
$$;