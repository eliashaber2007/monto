
-- Tighten pot_members insert: require authenticated user
DROP POLICY IF EXISTS "pot_members_insert_allowed" ON public.pot_members;

CREATE POLICY "pot_members_insert_authenticated" ON public.pot_members
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
