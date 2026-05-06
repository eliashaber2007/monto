import { supabase } from '@/integrations/supabase/client';

const PENDING_INVITE_TOKEN_KEY = 'pending_invite_token';
const PENDING_JOIN_KEY = 'pending_join_pot_id';
const PENDING_INVITE_URL_KEY = 'pendingInviteUrl';
const INVITE_PATH_RE = /\/(?:invite|join)\/([^/?#]+)/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function extractInviteToken(value: string | null | undefined): string | null {
  if (!value) return null;

  let path = value;
  try {
    path = new URL(value, window.location.origin).pathname;
  } catch {
    path = value;
  }

  const match = path.match(INVITE_PATH_RE);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function getPendingInviteToken(): string | null {
  return (
    localStorage.getItem(PENDING_INVITE_TOKEN_KEY) ||
    extractInviteToken(localStorage.getItem(PENDING_INVITE_URL_KEY)) ||
    localStorage.getItem(PENDING_JOIN_KEY)
  );
}

export function savePendingInviteToken(token: string) {
  localStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
  localStorage.setItem(PENDING_JOIN_KEY, token);
  localStorage.setItem(PENDING_INVITE_URL_KEY, `/invite/${encodeURIComponent(token)}`);
}

export function clearPendingInvite() {
  localStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
  localStorage.removeItem(PENDING_JOIN_KEY);
  localStorage.removeItem(PENDING_INVITE_URL_KEY);
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function normalizeJoinError(error: any): Error {
  if (error?.code === '23503' || error?.code === '22P02') {
    return new Error('This invite link is invalid or expired.');
  }

  if (String(error?.message ?? '').toLowerCase().includes('row-level security')) {
    return new Error('We could not join this pot because access was denied.');
  }

  return new Error(error?.message ?? 'Unable to join this pot. Please try again.');
}

function logSupabaseJoinError(stage: string, error: any) {
  console.error('[inviteJoin] Supabase pot_members join failed', {
    stage,
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });
}

function logFunctionJoinError(stage: string, error: any) {
  console.error('[inviteJoin] join-pot function failed', {
    stage,
    status: error?.status,
    name: error?.name,
    message: error?.message,
    details: error?.details,
    context: error?.context,
  });
}

export async function joinPotFromInviteToken(token: string, userId: string) {
  const potId = token.trim();
  if (!UUID_RE.test(potId)) {
    throw new Error('This invite link is invalid or expired.');
  }

  const { data, error } = await supabase.functions.invoke('join-pot', {
    body: { pot_id: potId, user_id: userId },
  });

  if (error) {
    logFunctionJoinError('invoke-join-pot', error);
    throw normalizeJoinError(error);
  }

  return { potId: data?.pot_id ?? potId, alreadyMember: Boolean(data?.already_member) };
}

export async function joinPendingInviteForUser(userId: string, timeoutMs: number, timeoutMessage: string) {
  const token = getPendingInviteToken();
  if (!token) return null;

  try {
    return await withTimeout(joinPotFromInviteToken(token, userId), timeoutMs, timeoutMessage);
  } finally {
    clearPendingInvite();
  }
}