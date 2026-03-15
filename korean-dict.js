/**
 * Cloudflare Pages Function
 * 경로: /functions/korean-dict.js → 자동으로 /korean-dict 엔드포인트 생성
 *
 * 국립국어원 표준국어대사전 API 프록시
 * - API 키는 Cloudflare 환경변수(KOREAN_DICT_KEY)에 저장
 * - 브라우저 CORS 문제를 우회
 * - 사용법: GET /korean-dict?word=사과
 */
export async function onRequestGet(context) {
  const apiKey = context.env.KOREAN_DICT_KEY;

  if (!apiKey) {
    return json({ error: 'KOREAN_DICT_KEY 환경변수가 설정되지 않았어요' }, 500);
  }

  const url = new URL(context.request.url);
  const word = url.searchParams.get('word');

  if (!word) {
    return json({ error: 'word 파라미터가 필요해요' }, 400);
  }

  try {
    // 국립국어원 표준국어대사전 API 호출
    const apiUrl = `https://stdict.korean.go.kr/api/search.do?key=${apiKey}&q=${encodeURIComponent(word)}&type_search=search&part=word&sort=popular&num=10&output=json`;
    const res = await fetch(apiUrl);

    if (!res.ok) {
      return json({ error: `사전 API 오류: ${res.status}` }, 502);
    }

    const data = await res.json();

    // 결과에서 정확히 일치하는 단어가 있는지 확인
    const items = data?.channel?.item || [];
    const exact = items.some(item => {
      const w = item.word?.replace(/-/g, '').replace(/\^/g, '').trim();
      return w === word;
    });

    return json({ word, exists: exact, count: items.length });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600', // 같은 단어 1시간 캐시
    },
  });
}
