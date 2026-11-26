// '#' 없는 짧은 주소 (2026-11-25 — 검색엔진 · 구글 심사 · 일부 앱이 '#' 뒤를 못 읽는 문제)  — react 없음, node --test 로 시험
//   /privacy · /terms · /beat · /judge · /search · /room · /future · /knows 로 들어오면 그 화면의 해시 주소로 바꿔 연다 (?src= 꼬리표는 그대로)
//   공유 · 검색엔진용 게임 소개 주소는 /g/<게임> (게이트웨이가 게임 서버의 공유 미리보기 /api/share/g/<게임> 으로 보낸다)
export const PRETTY = {
  privacy: '/privacy', terms: '/terms',
  beat: '/v2/beat', judge: '/archive', search: '/search', room: '/room', future: '/future', knows: '/knows',
}

// 들어온 주소(pathname · hash)가 짧은 주소면 바꿀 해시 경로, 아니면 null — 해시 주소가 있으면 그것이 먼저 (옛 링크 그대로)
export function prettyHash(pathname, hash) {
  if (hash && hash !== '#' && hash !== '#/') return null
  const key = String(pathname || '/').replace(/^\/+|\/+$/g, '')
  return Object.prototype.hasOwnProperty.call(PRETTY, key) ? PRETTY[key] : null
}

// 앱이 열릴 때 한 번 — 주소창을 '/?src=…#/화면' 으로 바꾼다 (새로 고침 · 뒤로 가기도 해시 라우터 그대로)
export function adoptPrettyPath(loc = typeof window !== 'undefined' ? window.location : null, hist = typeof window !== 'undefined' ? window.history : null) {
  if (!loc || !hist) return null
  const h = prettyHash(loc.pathname, loc.hash)
  if (h) hist.replaceState(null, '', '/' + (loc.search || '') + '#' + h)
  return h
}
