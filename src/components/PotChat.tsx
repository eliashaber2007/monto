import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface Member {
  user_id: string;
  role: string;
  profiles: {
    first_name: string;
    avatar_url: string | null;
    avatar_color: string | null;
    avatar_emoji: string | null;
  } | null;
}

interface Message {
  id: string;
  pot_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface PotChatProps {
  potId: string;
  potName: string;
  potEmoji?: string | null;
  members: Member[];
  onClose: () => void;
}

function timeLabel(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
}

function dateDivider(dateStr: string, t: (key: string) => string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return t('common.today');
  if (d.toDateString() === yesterday.toDateString()) return t('common.yesterday');
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PotChat({ potId, potName, potEmoji, members, onClose }: PotChatProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);

  const profileMap = useRef<Record<string, Member['profiles']>>({});
  members.forEach((m) => {
    profileMap.current[m.user_id] = m.profiles;
  });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('pot_messages')
        .select('*')
        .eq('pot_id', potId)
        .order('created_at', { ascending: true })
        .limit(200);
      setMessages((data as Message[]) ?? []);
    };
    load();
  }, [potId]);

  useEffect(() => {
    const channel = supabase
      .channel(`pot-chat-${potId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pot_messages', filter: `pot_id=eq.${potId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [potId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user) return;
    const upsertRead = async () => {
      await supabase
        .from('pot_chat_reads')
        .upsert(
          { pot_id: potId, user_id: user.id, last_read_at: new Date().toISOString() },
          { onConflict: 'pot_id,user_id' }
        );
    };
    upsertRead();
  }, [potId, user, messages.length]);

  useEffect(() => {
    if (mentionQuery === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        mentionRef.current && !mentionRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setMentionQuery(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mentionQuery]);

  const otherMembers = members.filter((m) => m.user_id !== user?.id);
  const filteredMentions = mentionQuery !== null
    ? otherMembers.filter((m) =>
        m.profiles?.first_name?.toLowerCase().startsWith(mentionQuery.toLowerCase())
      )
    : [];

  const handleTextChange = (val: string) => {
    setText(val);
    const cursorPos = inputRef.current?.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([a-zA-Z\s]*)$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1].trimEnd());
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (member: Member) => {
    const name = member.profiles?.first_name ?? 'User';
    const cursorPos = inputRef.current?.selectionStart ?? text.length;
    const textBeforeCursor = text.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([a-zA-Z\s]*)$/);
    if (mentionMatch) {
      const start = cursorPos - mentionMatch[0].length;
      const newText = text.slice(0, start) + `@${name} ` + text.slice(cursorPos);
      setText(newText);
    }
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (!text.trim() || !user || sending) return;
    setSending(true);
    const content = text.trim();

    const { error } = await supabase.from('pot_messages').insert({
      pot_id: potId,
      user_id: user.id,
      content,
    });

    if (!error) {
      setText('');
      const mentionRegex = /@([\w\s]+?)(?=\s@|\s[^@]|$)/g;
      let match;
      const notified = new Set<string>();
      while ((match = mentionRegex.exec(content)) !== null) {
        const mentionedName = match[1].trim();
        const mentionedMember = members.find(
          (m) => m.profiles?.first_name?.toLowerCase() === mentionedName.toLowerCase()
        );
        if (mentionedMember && mentionedMember.user_id !== user.id && !notified.has(mentionedMember.user_id)) {
          notified.add(mentionedMember.user_id);
          const senderName = profileMap.current[user.id]?.first_name ?? 'Someone';
          // In-app notification
          await supabase.from('notifications').insert({
            user_id: mentionedMember.user_id,
            pot_id: potId,
            type: 'mention',
            message: `${senderName} mentioned you in ${potName}`,
            variables: { name: senderName, pot: potName },
          });
          // Push notification via edge function
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-notification`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                },
                body: JSON.stringify({
                  type: 'mention',
                  pot_id: potId,
                  user_id: mentionedMember.user_id,
                  creator_name: senderName,
                }),
              }
            );
          } catch { /* fire and forget */ }
        }
      }
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && mentionQuery !== null) {
      e.preventDefault();
      setMentionQuery(null);
      return;
    }

    if (mentionQuery !== null && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, filteredMentions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        insertMention(filteredMentions[mentionIndex]);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderContent = (content: string) => {
    const memberNames = members
      .map((m) => m.profiles?.first_name)
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => b.length - a.length);

    if (memberNames.length === 0) return content;

    const escaped = memberNames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const mentionRegex = new RegExp(`@(?:${escaped.join('|')})`, 'g');

    const nodes: (string | JSX.Element)[] = [];
    let lastIndex = 0;

    for (const match of content.matchAll(mentionRegex)) {
      const start = match.index ?? 0;
      const mentionText = match[0];

      if (start > lastIndex) {
        nodes.push(content.slice(lastIndex, start));
      }

      nodes.push(
        <span key={`${start}-${mentionText}`} className="mention-tag">
          {mentionText}
        </span>
      );

      lastIndex = start + mentionText.length;
    }

    if (nodes.length === 0) return content;

    if (lastIndex < content.length) {
      nodes.push(content.slice(lastIndex));
    }

    return <span className="whitespace-pre-wrap">{nodes}</span>;
  };

  let lastDate = '';

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-foreground text-base">{potEmoji ? `${potEmoji} ` : ''}{t('chat.title')}</h2>
          <p className="text-xs text-muted-foreground">{members.length} {t('common.members')}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">{t('chat.noMessages')}</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.user_id === user?.id;
          const profile = profileMap.current[msg.user_id];
          const name = profile?.first_name ?? 'User';
          const initial = name.charAt(0).toUpperCase();
          const color = profile?.avatar_color ?? '#3b82f6';

          const msgDate = dateDivider(msg.created_at, t);
          let showDate = false;
          if (msgDate !== lastDate) {
            lastDate = msgDate;
            showDate = true;
          }

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="text-center my-4">
                  <span className="text-[11px] text-foreground/70 font-medium bg-secondary/80 px-3 py-1 rounded-full">
                    {msgDate}
                  </span>
                </div>
              )}
              <div className={`flex gap-2 mb-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isMe && (
                  <Avatar className="w-7 h-7 mt-1 shrink-0">
                    {profile?.avatar_url ? (
                      <AvatarImage src={profile.avatar_url} />
                    ) : null}
                    <AvatarFallback style={{ backgroundColor: color }} className="text-white text-[11px] font-bold">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!isMe && (
                    <span className="text-[11px] text-muted-foreground mb-0.5 ml-1">{name}</span>
                  )}
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                      isMe
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-secondary text-foreground rounded-bl-md'
                    }`}
                  >
                    {renderContent(msg.content)}
                  </div>
                  <span className={`text-[10px] text-muted-foreground mt-0.5 ${isMe ? 'mr-1 text-right' : 'ml-1'}`}>
                    {timeLabel(msg.created_at)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {mentionQuery !== null && filteredMentions.length > 0 && (
        <div className="px-4 pb-1" ref={mentionRef}>
          <div className="bg-card border border-border rounded-xl shadow-lg p-1 max-h-40 overflow-y-auto">
            {filteredMentions.map((m, i) => {
              const profile = m.profiles;
              const name = profile?.first_name ?? 'User';
              const color = profile?.avatar_color ?? '#3b82f6';
              return (
                <button
                  key={m.user_id}
                  onClick={() => insertMention(m)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    i === mentionIndex ? 'bg-accent' : 'hover:bg-accent/50'
                  }`}
                >
                  <Avatar className="w-6 h-6">
                    {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} /> : null}
                    <AvatarFallback style={{ backgroundColor: color }} className="text-white text-[10px] font-bold">
                      {name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-foreground font-medium">{name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-t border-border bg-card px-4 py-3 flex items-end gap-2 shrink-0">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.typePlaceholder')}
          rows={1}
          className="flex-1 resize-none bg-muted rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring max-h-24"
          style={{ minHeight: 40 }}
        />
        <Button
          size="icon"
          className="rounded-full w-10 h-10 shrink-0"
          disabled={!text.trim() || sending}
          onClick={handleSend}
        >
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}
