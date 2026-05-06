
DROP POLICY IF EXISTS pot_members_insert_authenticated ON public.pot_members;

CREATE POLICY "pot_members_insert_self"
ON public.pot_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'member');
