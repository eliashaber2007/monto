CREATE POLICY "profiles_select_pot_members" ON public.profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.pot_members pm1
    JOIN public.pot_members pm2 ON pm1.pot_id = pm2.pot_id
    WHERE pm1.user_id = auth.uid() AND pm2.user_id = profiles.id
  )
);