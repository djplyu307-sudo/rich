/**
 * Cloudflare Pages Function
 * 경로: /functions/ably-token.js → 자동으로 /ably-token 엔드포인트 생성
 *
 * Ably 토큰 발급 API
 * - API 키는 Cloudflare 환경변수(ABLY_API_KEY)에만 저장
 * - 클라이언트는 이 엔드포인트를 통해 임시 토큰만 받음
 */
export async function onRequestGet(context) {
  const apiKey = context.env.ABLY_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ABLY_API_KEY 환경변수가 설정되지 않았어요' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Ably REST API로 토큰 요청
    const [keyName, keySecret] = apiKey.split(':');
    const tokenRequest = {
      keyName,
      ttl: 3600000,       // 1시간 유효
      capability: '{"*":["publish","subscribe","presence"]}',
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(2),
    };

    // HMAC-SHA256 서명
    const signData = [
      tokenRequest.keyName,
      tokenRequest.ttl,
      tokenRequest.capability,
      tokenRequest.nonce,
      tokenRequest.timestamp,
      '',
    ].join('\n');

    const encoder = new TextEncoder();
    const keyData = encoder.encode(keySecret);
    const msgData = encoder.encode(signData);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(sig)));

    tokenRequest.mac = sigBase64;

    return new Response(JSON.stringify(tokenRequest), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// CORS preflight 처리
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
