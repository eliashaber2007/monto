import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importVapidKeys() {
  const publicKeyB64 = Deno.env.get('VAPID_PUBLIC_KEY')!;
  const privateKeyB64 = Deno.env.get('VAPID_PRIVATE_KEY')!;

  const publicKeyBytes = base64UrlToUint8Array(publicKeyB64);
  const privateKeyBytes = base64UrlToUint8Array(privateKeyB64);

  const publicKey = await crypto.subtle.importKey(
    'raw',
    publicKeyBytes as BufferSource,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    [],
  );

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes as BufferSource,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign'],
  );

  return { publicKey, privateKey, publicKeyBytes };
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = '';
  for (const byte of arr) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createJWT(endpoint: string, privateKey: CryptoKey): Promise<string> {
  const origin = new URL(endpoint).origin;
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: 'mailto:notifications@montofinance.app',
  };

  const encoder = new TextEncoder();
  const headerB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoder.encode(unsigned),
  );

  const sigArray = new Uint8Array(signature);
  let rawSig: Uint8Array;

  if (sigArray.length === 64) {
    rawSig = sigArray;
  } else {
    const r = parseDERInteger(sigArray, 2);
    const sOffset = 2 + sigArray[3] + 2;
    const s = parseDERInteger(sigArray, sOffset);
    rawSig = new Uint8Array(64);
    rawSig.set(padTo32(r), 0);
    rawSig.set(padTo32(s), 32);
  }

  const sigB64 = uint8ArrayToBase64Url(rawSig);
  return `${unsigned}.${sigB64}`;
}

function parseDERInteger(buf: Uint8Array, offset: number): Uint8Array {
  const len = buf[offset + 1];
  return buf.slice(offset + 2, offset + 2 + len);
}

function padTo32(arr: Uint8Array): Uint8Array {
  if (arr.length === 32) return arr;
  if (arr.length > 32) return arr.slice(arr.length - 32);
  const padded = new Uint8Array(32);
  padded.set(arr, 32 - arr.length);
  return padded;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPrivateKey: CryptoKey,
  vapidPublicKeyBytes: Uint8Array,
): Promise<boolean> {
  try {
    const jwt = await createJWT(subscription.endpoint, vapidPrivateKey);
    const vapidPublicB64 = uint8ArrayToBase64Url(vapidPublicKeyBytes);

    const localKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    );

    const clientPublicKey = base64UrlToUint8Array(subscription.p256dh);
    const clientAuthSecret = base64UrlToUint8Array(subscription.auth);

    const peerPublicKey = await crypto.subtle.importKey(
      'raw',
      clientPublicKey as BufferSource,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );

    const sharedSecret = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: peerPublicKey },
      localKeyPair.privateKey,
      256,
    );

    const localPublicKeyRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
    const localPublicKeyBytes = new Uint8Array(localPublicKeyRaw);

    const encoder = new TextEncoder();

    const authInfo = encoder.encode('Content-Encoding: auth\0');
    const prkeyMaterial = await crypto.subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, ['deriveBits']);
    const ikm = new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: clientAuthSecret as BufferSource, info: authInfo as BufferSource },
      prkeyMaterial,
      256,
    ));

    const keyLabel = encoder.encode('Content-Encoding: aes128gcm\0');
    const nonceLabel = encoder.encode('Content-Encoding: nonce\0');

    const context = new Uint8Array(140);
    const contextPrefix = encoder.encode('P-256\0');
    let offset = 0;
    context.set(contextPrefix, offset); offset += contextPrefix.length;
    context[offset++] = 0; context[offset++] = 65;
    context.set(new Uint8Array(clientPublicKey), offset); offset += 65;
    context[offset++] = 0; context[offset++] = 65;
    context.set(localPublicKeyBytes, offset);

    const salt = crypto.getRandomValues(new Uint8Array(16));

    const ikmKey = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);

    const cekInfoBuf = new Uint8Array(keyLabel.length + context.length);
    cekInfoBuf.set(keyLabel);
    cekInfoBuf.set(context, keyLabel.length);

    const cekBits = await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfoBuf },
      ikmKey,
      128,
    );

    const nonceInfoBuf = new Uint8Array(nonceLabel.length + context.length);
    nonceInfoBuf.set(nonceLabel);
    nonceInfoBuf.set(context, nonceLabel.length);

    const ikmKey2 = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);
    const nonceBits = await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfoBuf },
      ikmKey2,
      96,
    );

    const payloadBytes = encoder.encode(payload);
    const paddedPayload = new Uint8Array(payloadBytes.length + 2);
    paddedPayload.set(payloadBytes);
    paddedPayload[payloadBytes.length] = 2;

    const cekKey = await crypto.subtle.importKey('raw', cekBits, { name: 'AES-GCM' }, false, ['encrypt']);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonceBits },
      cekKey,
      paddedPayload,
    );

    const rs = payloadBytes.length + 2 + 16 + 1;
    const header = new Uint8Array(86);
    header.set(salt, 0);
    new DataView(header.buffer).setUint32(16, rs > 4096 ? 4096 : rs);
    header[20] = 65;
    header.set(localPublicKeyBytes, 21);

    const body = new Uint8Array(header.length + encrypted.byteLength);
    body.set(header);
    body.set(new Uint8Array(encrypted), header.length);

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${vapidPublicB64}`,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        'TTL': '86400',
      },
      body,
    });

    if (response.status === 410 || response.status === 404) {
      await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', subscription.endpoint);
      return false;
    }

    if (!response.ok) {
      const text = await response.text();
      console.error('Push failed:', response.status, text);
      return false;
    }

    return true;
  } catch (err) {
    console.error('sendWebPush error:', err);
    return false;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, title, body, url } = await req.json();

    if (!user_id || !body) {
      return new Response(JSON.stringify({ error: 'user_id and body required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: subscriptions, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user_id);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { publicKey: _pk, privateKey: vapidPrivateKey, publicKeyBytes: vapidPublicKeyBytes } = await importVapidKeys();

    const payload = JSON.stringify({
      title: title || 'Monto',
      body,
      url: url || '/',
    });

    let sent = 0;
    for (const sub of subscriptions) {
      const ok = await sendWebPush(sub, payload, vapidPrivateKey, vapidPublicKeyBytes);
      if (ok) sent++;
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('send-push-notification error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
