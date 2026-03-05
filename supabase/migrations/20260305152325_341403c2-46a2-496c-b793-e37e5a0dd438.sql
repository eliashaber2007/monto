-- Remove duplicate join-notification trigger to prevent double notifications.
-- Keep a single in-app notification source via on_member_joined -> notify_member_joined().
DROP TRIGGER IF EXISTS on_pot_member_joined ON public.pot_members;