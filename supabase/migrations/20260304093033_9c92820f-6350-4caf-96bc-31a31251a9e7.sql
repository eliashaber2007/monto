
-- Drop the two broken restrictive SELECT policies on pots
DROP POLICY IF EXISTS "Members can view their pots" ON public.pots;
DROP POLICY IF EXISTS "pots_select_members" ON public.pots;

-- Create a single PERMISSIVE SELECT policy
CREATE POLICY "pots_select_members" ON public.pots
  FOR SELECT
  TO authenticated
  USING (is_pot_member(id, auth.uid()));
