
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: notify when member joins
CREATE OR REPLACE FUNCTION public.email_notify_member_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_pot RECORD;
BEGIN
  SELECT * INTO v_pot FROM public.pots WHERE id = NEW.pot_id;
  -- Skip if the new member is the creator
  IF v_pot.created_by = NEW.user_id THEN
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-email-notification',
    body := jsonb_build_object(
      'type', 'member_joined',
      'pot_id', NEW.pot_id,
      'user_id', NEW.user_id
    )::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
    )::jsonb
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'email_notify_member_joined error: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_email_member_joined
  AFTER INSERT ON public.pot_members
  FOR EACH ROW
  EXECUTE FUNCTION public.email_notify_member_joined();

-- Trigger function: notify when withdrawal requested (pending)
CREATE OR REPLACE FUNCTION public.email_notify_withdrawal_requested()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

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
$$;

CREATE TRIGGER trg_email_withdrawal_requested
  AFTER INSERT ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.email_notify_withdrawal_requested();

-- Trigger function: notify when withdrawal approved
CREATE OR REPLACE FUNCTION public.email_notify_withdrawal_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF OLD.status = 'approved' OR NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-email-notification',
    body := jsonb_build_object(
      'type', 'withdrawal_approved',
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
  RAISE LOG 'email_notify_withdrawal_approved error: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_email_withdrawal_approved
  AFTER UPDATE ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.email_notify_withdrawal_approved();

-- Trigger function: notify when pot is closed
CREATE OR REPLACE FUNCTION public.email_notify_pot_closed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF OLD.status = 'closed' OR NEW.status <> 'closed' THEN
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-email-notification',
    body := jsonb_build_object(
      'type', 'pot_closed',
      'pot_id', NEW.id
    )::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
    )::jsonb
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'email_notify_pot_closed error: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_email_pot_closed
  AFTER UPDATE ON public.pots
  FOR EACH ROW
  EXECUTE FUNCTION public.email_notify_pot_closed();
