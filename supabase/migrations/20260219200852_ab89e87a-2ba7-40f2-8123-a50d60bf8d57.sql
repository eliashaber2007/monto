
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pot_id UUID NOT NULL REFERENCES public.pots(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow inserts from triggers (security definer functions will handle this)
CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger function: notify creator when a member joins
CREATE OR REPLACE FUNCTION public.notify_member_joined()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pot RECORD;
  v_profile RECORD;
BEGIN
  -- Skip if the new member is the creator
  SELECT * INTO v_pot FROM public.pots WHERE id = NEW.pot_id;
  IF v_pot.created_by = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, pot_id, type, message)
  VALUES (
    v_pot.created_by,
    NEW.pot_id,
    'member_joined',
    COALESCE(v_profile.first_name, 'Someone') || ' joined ' || v_pot.name
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_member_joined
  AFTER INSERT ON public.pot_members
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_member_joined();

-- Trigger function: notify creator when a receipt is uploaded
CREATE OR REPLACE FUNCTION public.notify_receipt_uploaded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pot RECORD;
  v_profile RECORD;
BEGIN
  -- Only fire when status changes to 'submitted'
  IF NEW.status <> 'submitted' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_pot FROM public.pots WHERE id = NEW.pot_id;
  -- Don't notify creator about their own receipts
  IF v_pot.created_by = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, pot_id, type, message)
  VALUES (
    v_pot.created_by,
    NEW.pot_id,
    'receipt_uploaded',
    COALESCE(v_profile.first_name, 'Someone') || ' uploaded a receipt in ' || v_pot.name
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_receipt_uploaded
  AFTER INSERT OR UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_receipt_uploaded();
