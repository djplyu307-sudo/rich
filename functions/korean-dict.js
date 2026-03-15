/**
 * Cloudflare Pages Function
 * 경로: /functions/korean-dict.js → 자동으로 /korean-dict 엔드포인트 생성
 *
 * 국립국어원 표준국어대사전 API 프록시
 * - GET /korean-dict?word=사과        → 단어 실존 여부 확인
 * - GET /korean-dict?startWith=사     → 해당 글자로 시작하는 단어 목록 반환 (AI용)
 */
export async function onRequestGet(context) {
  const apiKey = context.env.KOREAN_DICT_KEY;
  if (!apiKey) return json({ error: 'KOREAN_DICT_KEY 환경변수가 설정되지 않았어요' }, 500);

  const url = new URL(context.request.url);
  const word = url.searchParams.get('word');
  const startWith = url.searchParams.get('startWith');

  // ── 모드 1: 특정 글자로 시작하는 단어 검색 (AI 응답용) ──
  if (startWith) {
    try {
      // 국립국어원 서버 SSL 호환성을 위해 http로 호출
      const apiUrl = `http://stdict.korean.go.kr/api/search.do?key=${apiKey}&q=${encodeURIComponent(startWith)}&type_search=start&part=word&sort=popular&num=30&output=json`;
      const res = await fetch(apiUrl);
      if (!res.ok) return json({ error: `사전 API 오류: ${res.status}` }, 502);

      const data = await res.json();
      const items = data?.channel?.item || [];

      // 필터링: 순수 한글, 2~5글자, 해당 글자로 시작, 이미 사용한 단어 제외
      // 주의: API가 반환하는 word에 '-', '^', '__', 공백 등이 포함될 수 있음
      const words = [];
      for (const item of items) {
        // 특수문자 제거해서 실제 단어 추출
        const cleaned = (item.word || '')
          .replace(/-/g, '')
          .replace(/\^/g, '')
          .replace(/__/g, '')
          .replace(/\s/g, '')
          .trim();

        // 조건: 순수 한글 2~5글자 + 첫 글자 일치
        if (
          cleaned.length >= 2 &&
          cleaned.length <= 5 &&
          /^[가-힣]+$/.test(cleaned) &&
          cleaned.charAt(0) === startWith
        ) {
          words.push(cleaned);
        }
      }

      // 중복 제거
      const unique = [...new Set(words)];

      // words가 비면 필터 없이 한글 단어만 반환 (더 관대하게)
      if (unique.length === 0) {
        const fallback = [];
        for (const item of items) {
          const cleaned = (item.word || '')
            .replace(/-/g, '').replace(/\^/g, '').replace(/__/g, '').replace(/\s/g, '').trim();
          if (/^[가-힣]+$/.test(cleaned) && cleaned.length >= 2 && cleaned.length <= 6) {
            fallback.push(cleaned);
          }
        }
        return json({ startWith, words: [...new Set(fallback)], filtered: false, total: items.length });
      }

      return json({ startWith, words: unique, filtered: true, total: items.length });
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }

  // ── 모드 2: 단어 실존 여부 확인 (유저 입력 검증용) ──
  if (!word) return json({ error: 'word 또는 startWith 파라미터가 필요해요' }, 400);

  try {
    const apiUrl = `http://stdict.korean.go.kr/api/search.do?key=${apiKey}&q=${encodeURIComponent(word)}&type_search=search&part=word&sort=popular&num=10&output=json`;
    const res = await fetch(apiUrl);
    if (!res.ok) return json({ error: `사전 API 오류: ${res.status}` }, 502);
    const data = await res.json();
    const items = data?.channel?.item || [];
    const exact = items.some(item => {
      const w = (item.word || '').replace(/-/g, '').replace(/\^/g, '').replace(/__/g, '').trim();
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
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
