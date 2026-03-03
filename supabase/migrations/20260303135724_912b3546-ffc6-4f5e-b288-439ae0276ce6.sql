
-- Create pot_messages table
CREATE TABLE public.pot_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pot_id UUID NOT NULL REFERENCES public.pots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pot_chat_reads table to track last read timestamp per user per pot
CREATE TABLE public.pot_chat_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pot_id UUID NOT NULL REFERENCES public.pots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (pot_id, user_id)
);

-- Enable RLS
ALTER TABLE public.pot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pot_chat_reads ENABLE ROW LEVEL SECURITY;

-- RLS for pot_messages: only pot members can read
CREATE POLICY "pot_messages_select_members" ON public.pot_messages
  FOR SELECT TO authenticated
  USING (is_pot_member(pot_id, auth.uid()));

-- RLS for pot_messages: only pot members can insert their own messages
CREATE POLICY "pot_messages_insert_own" ON public.pot_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_pot_member(pot_id, auth.uid()));

-- RLS for pot_chat_reads: users can read their own
CREATE POLICY "pot_chat_reads_select_own" ON public.pot_chat_reads
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- RLS for pot_chat_reads: users can insert their own
CREATE POLICY "pot_chat_reads_insert_own" ON public.pot_chat_reads
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS for pot_chat_reads: users can update their own
CREATE POLICY "pot_chat_reads_update_own" ON public.pot_chat_reads
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for pot_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.pot_messages;
