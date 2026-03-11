
-- Add contributions_restricted column to pots table
ALTER TABLE public.pots ADD COLUMN contributions_restricted BOOLEAN NOT NULL DEFAULT false;

-- Update notify_withdrawal_requested to also notify leaders
CREATE OR REPLACE FUNCTION public.notify_withdrawal_requested()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pot RECORD;
  v_profile RECORD;
  v_leader RECORD;
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

  -- Notify the creator
  INSERT INTO public.notifications (user_id, pot_id, type, message)
  VALUES (
    v_pot.created_by,
    NEW.pot_id,
    'withdrawal_requested',
    COALESCE(v_profile.first_name, 'Someone') || ' requested a withdrawal of €' || NEW.amount || ' from ' || v_pot.name
  );

  -- Notify all leaders (except the requester)
  FOR v_leader IN 
    SELECT pm.user_id FROM public.pot_members pm 
    WHERE pm.pot_id = NEW.pot_id 
    AND pm.role = 'leader' 
    AND pm.user_id != NEW.user_id
  LOOP
    INSERT INTO public.notifications (user_id, pot_id, type, message)
    VALUES (
      v_leader.user_id,
      NEW.pot_id,
      'withdrawal_requested',
      COALESCE(v_profile.first_name, 'Someone') || ' requested a withdrawal of €' || NEW.amount || ' from ' || v_pot.name
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Update email_notify_withdrawal_requested to also notify leaders
CREATE OR REPLACE FUNCTION public.email_notify_withdrawal_requested()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_leader RECORD;
  v_pot RECORD;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_pot FROM public.pots WHERE id = NEW.pot_id;

  -- Notify creator via email
  PERFORM extensions.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-email-notification',
    body := jsonb_build_object(
      'type', 'withdrawal_requested',
      'pot_id', NEW.pot_id,
      'user_id', NEW.user_id,
      'amount', NEW.amount
    )::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
    )::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'email_notify_withdrawal_requested error: %', SQLERRM;
  RETURN NEW;
END;
$function$;
