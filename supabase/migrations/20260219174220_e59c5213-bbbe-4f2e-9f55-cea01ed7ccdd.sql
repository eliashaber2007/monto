-- Allow pot creator to update their pot (for closing)
CREATE POLICY "Creator can update own pots"
ON public.pots
FOR UPDATE
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);
