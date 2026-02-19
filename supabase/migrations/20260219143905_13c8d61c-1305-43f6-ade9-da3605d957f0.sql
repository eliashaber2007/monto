
-- Drop the existing restrictive insert policies and recreate as permissive
DROP POLICY IF EXISTS pots_insert_own ON public.pots;
DROP POLICY IF EXISTS pot_members_insert_authenticated ON public.pot_members;

CREATE POLICY pots_insert_own ON public.pots
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY pot_members_insert_authenticated ON public.pot_members
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
