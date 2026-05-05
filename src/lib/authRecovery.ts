import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type RecoveryCallbackParams = {
  isRecovery: boolean;
  code: string | null;
  tokenHash: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  type: string | null;
  error: string | null;
  errorDescription: string | null;
};

export type RecoverySessionResult = {
  isRecovery: boolean;
  session: Session | null;
  error: Error | null;
};

export const parseRecoveryCallbackUrl = (href: string): RecoveryCallbackParams => {
  const url = new URL(href);
  const searchParams = url.searchParams;
  const rawHash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const hashQuery = rawHash.includes('?') ? rawHash.slice(rawHash.indexOf('?') + 1) : rawHash;
  const hashParams = new URLSearchParams(hashQuery);
  const getParam = (name: string) => searchParams.get(name) ?? hashParams.get(name);
  const type = getParam('type');
  const tokenHash = getParam('token_hash');

  return {
    isRecovery: url.pathname === '/reset-password' || type === 'recovery' || (!!tokenHash && type === 'recovery'),
    code: getParam('code'),
    tokenHash,
    accessToken: getParam('access_token'),
    refreshToken: getParam('refresh_token'),
    type,
    error: getParam('error'),
    errorDescription: getParam('error_description') ?? getParam('error_code'),
  };
};

export const establishRecoverySessionFromUrl = async (href: string): Promise<RecoverySessionResult> => {
  const params = parseRecoveryCallbackUrl(href);
  if (!params.isRecovery) return { isRecovery: false, session: null, error: null };
  if (params.error) return { isRecovery: true, session: null, error: new Error(params.errorDescription ?? params.error) };

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    return { isRecovery: true, session: data.session, error };
  }

  if (params.accessToken && params.refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    return { isRecovery: true, session: data.session, error };
  }

  if (params.tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: params.tokenHash,
      type: 'recovery',
    });
    return { isRecovery: true, session: data.session, error };
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  return { isRecovery: true, session, error };
};