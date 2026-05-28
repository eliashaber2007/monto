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
  const timestamp = localStorage.getItem('pending_invite_timestamp');
  const now = Date.now();
  const age = timestamp ? now - parseInt(timestamp) : null;
  const isExpired = !timestamp || age! > 600000;

  console.log('[inviteJoin] getPendingInviteToken called:', {
    timestamp,
    now,
    age,
    isExpired,
    maxAge: 600000
  });

  if (isExpired) {
    console.log('[inviteJoin] Token expired or missing, clearing pending invite');
    clearPendingInvite();
    localStorage.removeItem('pending_invite_timestamp');
    return null;
  }

  const token = (
    localStorage.getItem(PENDING_INVITE_TOKEN_KEY) ||
    extractInviteToken(localStorage.getItem(PENDING_INVITE_URL_KEY)) ||
    localStorage.getItem(PENDING_JOIN_KEY)
  );

  console.log('[inviteJoin] Returning token:', {
    token,
    fromKey: token === localStorage.getItem(PENDING_INVITE_TOKEN_KEY) ? PENDING_INVITE_TOKEN_KEY :
             token === extractInviteToken(localStorage.getItem(PENDING_INVITE_URL_KEY)) ? PENDING_INVITE_URL_KEY :
             PENDING_JOIN_KEY
  });

  return token;
}

export function savePendingInviteToken(token: string) {
  const timestamp = Date.now().toString();
  console.log('[inviteJoin] savePendingInviteToken called:', {
    token,
    timestamp,
    url: `/invite/${encodeURIComponent(token)}`
  });
  localStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
  localStorage.setItem(PENDING_JOIN_KEY, token);
  localStorage.setItem(PENDING_INVITE_URL_KEY, `/invite/${encodeURIComponent(token)}`);
  localStorage.setItem('pending_invite_timestamp', timestamp);
  console.log('[inviteJoin] Saved to localStorage keys:', {
    [PENDING_INVITE_TOKEN_KEY]: localStorage.getItem(PENDING_INVITE_TOKEN_KEY),
    [PENDING_JOIN_KEY]: localStorage.getItem(PENDING_JOIN_KEY),
    [PENDING_INVITE_URL_KEY]: localStorage.getItem(PENDING_INVITE_URL_KEY),
    pending_invite_timestamp: localStorage.getItem('pending_invite_timestamp')
  });
}

export function clearPendingInvite() {
  localStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
  localStorage.removeItem(PENDING_JOIN_KEY);
  localStorage.removeItem(PENDING_INVITE_URL_KEY);
  localStorage.removeItem('pending_invite_timestamp');
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

function cleanInvitePotId(value: string): string {
  const trimmed = value.trim();
  const extractedFromPath = extractInviteToken(trimmed);
  const candidate = (extractedFromPath ?? trimmed).trim();

  try {
    return decodeURIComponent(candidate).trim();
  } catch {
    return candidate;
  }
}

async function logJoinPotResponseError(response: Response, responseBodyText: string) {
  let responseBody: unknown = responseBodyText;
  try {
    responseBody = JSON.parse(responseBodyText);
  } catch {
    // Keep raw text when the function returns non-JSON output.
  }

  console.error('[inviteJoin] join-pot response error body', {
    status: response.status,
    statusText: response.statusText,
    body: responseBody,
  });
}

export async function joinPotFromInviteToken(token: string, userId: string) {
  try {
    const potId = cleanInvitePotId(token);
    if (!UUID_RE.test(potId)) {
      throw new Error('This invite link is invalid or expired.');
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) {
      logFunctionJoinError('get-session', sessionError ?? new Error('Missing active session'));
      throw normalizeJoinError(sessionError ?? new Error('Missing active session'));
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/join-pot`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pot_id: potId, user_id: userId }),
    });

    const responseBodyText = await response.text();
    let data: any = null;
    try {
      data = responseBodyText ? JSON.parse(responseBodyText) : null;
    } catch {
      data = { error: responseBodyText || response.statusText };
    }

    if (!response.ok) {
      await logJoinPotResponseError(response, responseBodyText);
      throw normalizeJoinError(data ?? new Error(response.statusText));
    }

    return {
      potId: data?.potId ?? data?.pot_id ?? potId,
      potName: data?.potName ?? data?.pot_name ?? null,
      alreadyMember: Boolean(data?.alreadyMember ?? data?.already_member),
    };
  } catch (err) {
    clearPendingInvite();
    throw err;
  }
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