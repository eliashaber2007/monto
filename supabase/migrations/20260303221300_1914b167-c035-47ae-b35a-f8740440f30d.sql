
-- Create trigger function to notify creator when a withdrawal is requested
CREATE OR REPLACE FUNCTION public.notify_withdrawal_requested()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_pot RECORD;
  v_profile RECORD;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_pot FROM public.pots WHERE id = NEW.pot_id;
  
  -- Don't notify if the requester is the creator
  IF v_pot.created_by = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, pot_id, type, message)
  VALUES (
    v_pot.created_by,
    NEW.pot_id,
    'withdrawal_requested',
    COALESCE(v_profile.first_name, 'Someone') || ' requested a withdrawal of €' || NEW.amount || ' from ' || v_pot.name
  );

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_withdrawal_requested
  AFTER INSERT ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_withdrawal_requested();
