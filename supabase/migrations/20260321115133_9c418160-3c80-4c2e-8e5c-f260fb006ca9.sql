
-- Add variables column to notifications table
ALTER TABLE public.notifications ADD COLUMN variables jsonb DEFAULT NULL;

-- Update notify_member_joined to store structured variables
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
  SELECT * INTO v_pot FROM public.pots WHERE id = NEW.pot_id;
  IF v_pot.created_by = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, pot_id, type, message, variables)
  VALUES (
    v_pot.created_by,
    NEW.pot_id,
    'member_joined',
    COALESCE(v_profile.first_name, 'Someone') || ' joined ' || v_pot.name,
    jsonb_build_object('name', COALESCE(v_profile.first_name, 'Someone'), 'pot', v_pot.name)
  );

  RETURN NEW;
END;
$$;

-- Update notify_receipt_uploaded to store structured variables
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
  IF NEW.status <> 'submitted' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_pot FROM public.pots WHERE id = NEW.pot_id;
  IF v_pot.created_by = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, pot_id, type, message, variables)
  VALUES (
    v_pot.created_by,
    NEW.pot_id,
    'receipt_uploaded',
    COALESCE(v_profile.first_name, 'Someone') || ' uploaded a receipt in ' || v_pot.name,
    jsonb_build_object('name', COALESCE(v_profile.first_name, 'Someone'), 'pot', v_pot.name)
  );

  RETURN NEW;
END;
$$;

-- Update notify_withdrawal_requested to store structured variables
CREATE OR REPLACE FUNCTION public.notify_withdrawal_requested()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pot RECORD;
  v_profile RECORD;
  v_leader RECORD;
  v_name TEXT;
  v_vars jsonb;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_pot FROM public.pots WHERE id = NEW.pot_id;
  
  IF v_pot.created_by = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.user_id;
  v_name := COALESCE(v_profile.first_name, 'Someone');
  v_vars := jsonb_build_object('name', v_name, 'amount', NEW.amount::text, 'pot', v_pot.name);

  INSERT INTO public.notifications (user_id, pot_id, type, message, variables)
  VALUES (
    v_pot.created_by,
    NEW.pot_id,
    'withdrawal_requested',
    v_name || ' requested a withdrawal of €' || NEW.amount || ' from ' || v_pot.name,
    v_vars
  );

  FOR v_leader IN 
    SELECT pm.user_id FROM public.pot_members pm 
    WHERE pm.pot_id = NEW.pot_id 
    AND pm.role = 'leader' 
    AND pm.user_id != NEW.user_id
  LOOP
    INSERT INTO public.notifications (user_id, pot_id, type, message, variables)
    VALUES (
      v_leader.user_id,
      NEW.pot_id,
      'withdrawal_requested',
      v_name || ' requested a withdrawal of €' || NEW.amount || ' from ' || v_pot.name,
      v_vars
    );
  END LOOP;

  RETURN NEW;
END;
$$;
