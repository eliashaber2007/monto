
-- Drop restrictive INSERT policies and replace with permissive ones

-- POTS
DROP POLICY IF EXISTS pots_insert_own ON public.pots;
CREATE POLICY pots_insert_own ON public.pots
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- POT_MEMBERS
DROP POLICY IF EXISTS pot_members_insert_authenticated ON public.pot_members;
CREATE POLICY pot_members_insert_authenticated ON public.pot_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- PROFILES
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
