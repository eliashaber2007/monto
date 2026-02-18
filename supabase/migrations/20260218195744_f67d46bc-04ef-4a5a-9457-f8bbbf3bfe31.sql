
-- ============================================================
-- Monto – Step 2: RLS + Policies + Helper Function + Realtime
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pot_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Helper: check membership without recursion
CREATE OR REPLACE FUNCTION public.is_pot_member(p_pot_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pot_members
    WHERE pot_id = p_pot_id AND user_id = p_user_id
  );
$$;

-- POTS policies
CREATE POLICY "pots_select_members" ON public.pots
  FOR SELECT USING (public.is_pot_member(id, auth.uid()));

CREATE POLICY "pots_insert_own" ON public.pots
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- POT_MEMBERS policies
CREATE POLICY "pot_members_select_same_pot" ON public.pot_members
  FOR SELECT USING (public.is_pot_member(pot_id, auth.uid()));

CREATE POLICY "pot_members_insert_allowed" ON public.pot_members
  FOR INSERT WITH CHECK (true);

-- TRANSACTIONS policies
CREATE POLICY "transactions_select_pot_members" ON public.transactions
  FOR SELECT USING (public.is_pot_member(pot_id, auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
