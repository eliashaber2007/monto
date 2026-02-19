
-- Drop the overly permissive insert policy and replace with a restrictive one
-- Inserts only happen via SECURITY DEFINER trigger functions, so no user needs INSERT access
DROP POLICY "System can insert notifications" ON public.notifications;

CREATE POLICY "No direct insert"
  ON public.notifications FOR INSERT
  WITH CHECK (false);
