// 해시 주소 읽기 · 아는 화면 이름 — react 없음 (node --test 로 시험: tests/routes.test.mjs). router.js · App.jsx 가 이 파일을 쓴다
//   새 화면을 만들면 ROUTE_NAMES 에 이름을 더한다 (시험이 App.jsx 의 route.name 비교 · 홈 단추 목록과 맞는지 본다)
//   이 밖의 주소(오타 · 없어진 옛 주소 · 잘린 링크)는 App.jsx 가 첫 화면(#/)으로 바꿔 연다
//     — 2026-11-25 전체 시험: '#/zzz' 가 홈 단추 없는 「최후의 변론」 사건 목록 + 튜토리얼로 열려 다른 게임으로 갈 길이 없었다

export const ROUTE_NAMES = Object.freeze([
  'title', 'hub', 'next', 'account', 'privacy', 'terms',          // 첫 화면 · 허브 · 계정 · 약관
  'archive', 'case', 'trial', 'records', 'm',                      // 최후의 변론
  'future', 'search', 'room', 'knows', 'train', 'beat', 'v2',      // 다른 게임 (v2 = 시제품 · 옛 미리보기 주소 · beat = /g/beat, 옛 #/v2/beat)
])
// #/v2/<id> 로 여는 것 — 시제품 4개 + 정식 주소로 옮긴 옛 미리보기 주소(App.jsx 가 정식 주소로 넘긴다)
export const V2_IDS = Object.freeze(['beat', 'rules', 'edge', 'tim', 'knows', 'train', 'future', 'search', 'room'])

// 앱이 그릴 줄 아는 주소인가 (아니면 첫 화면으로)
export function knownRoute(route) {
  const name = (route && route.name) || 'title'
  if (!ROUTE_NAMES.includes(name)) return false
  return name !== 'v2' || V2_IDS.includes(route.id)
}

// '%' 가 깨진 주소(예: 메신저가 자른 '%E0%A4%A')에서도 멈추지 않게 — 못 풀면 그대로 둔다
//   (예전엔 decodeURIComponent 오류로 화면 전체가 '문제가 생겼습니다' 로 바뀌었다 — 2026-11-25 전체 시험)
const decode = (s) => {
  try { return decodeURIComponent(s) } catch { return s }
}

// '#/case/abc' → { name: 'case', id: 'abc', sub: null }
export function parseHash(hash) {
  const parts = (String(hash || '').replace(/^#\/?/, '') || '').split('/').filter(Boolean)
  return {
    name: parts[0] || 'title',
    id: parts[1] ? decode(parts[1]) : null,
    sub: parts[2] ? decode(parts[2]) : null,   // #/m/case/:id · #/m/join/:token
  }
}

// ------------------------------------------------------------------ 게임 주소 /g/<게임> (2026-11-26 허브 유지 + 게임 독립)
//   단독 실행 게임(STANDALONE)은 /g/<게임>[/id[/sub]] 그 주소 그대로 연다 — 주소창에 '#' 없음. 게임 id = 화면 이름
//   아직 옮기지 않은 게임의 /g/<게임> 은 예전처럼 해시 주소(G_HASH)로 바꿔 연다. 옛 해시 주소(#/room …)는 /g/room 으로 넘긴다
//   목록은 game.json 의 standalone · hash 와 같아야 한다 (tests/platform.test.mjs 가 대조)
export const STANDALONE = Object.freeze(['room', 'future', 'search', 'knows', 'train', 'beat', 'judge'])
// 최후의 변론은 화면이 여럿이다 — /g/judge = 사건 목록(archive), /g/judge/<화면>/… = #/<화면>/… (case · trial · records · m)
export const JUDGE_ROUTES = Object.freeze(['archive', 'case', 'trial', 'records', 'm'])
export const G_HASH = Object.freeze({
  beat: '/v2/beat', judge: '/archive', search: '/search', room: '/room', future: '/future', knows: '/knows',
  train: '/train', rules: '/v2/rules', edge: '/v2/edge', tim: '/v2/tim',
})
const G_PATH = /^\/g\/([a-z0-9]{1,16})(?:\/(.*?))?\/?$/
const GO = /^[A-Za-z0-9_.~-]{1,64}(\/[A-Za-z0-9_.~-]{1,160}){0,2}$/   // 공유 링크의 ?go= (서버 share_games.py 와 같은 규칙)
const hasHash = (h) => !!h && h !== '#' && h !== '#/'
const isStandalone = (id) => STANDALONE.includes(id)

// '/g/room/abc' → { id: 'room', rest: 'abc' } · 아니면 null
export function gameOfPath(pathname) {
  const m = G_PATH.exec(String(pathname || ''))
  return m ? { id: m[1], rest: m[2] || '' } : null
}

// 앱 경로('/room/x' · '/hub') → 주소창에 쓸 주소. 단독 실행 게임은 /g/<게임>/…, 나머지는 /#/…
export function urlFor(path) {
  const p = '/' + String(path || '').replace(/^#?\/*/, '')
  const parts = p.split('/')
  const first = parts[1] || ''
  // 최후의 변론의 화면들 → /g/judge/… (사건 목록은 /g/judge)
  if (isStandalone('judge') && JUDGE_ROUTES.includes(first)) {
    const rest = p.replace(/\/+$/, '')
    return rest === '/archive' ? '/g/judge' : '/g/judge' + rest
  }
  if (isStandalone(first)) return '/g' + p.replace(/\/+$/, '')
  // 옛 시제품 주소 /v2/<게임> — 단독 실행으로 옮긴 게임(도마 박자)은 /g/<게임> 으로
  if (first === 'v2' && isStandalone(parts[2] || '')) return '/g/' + parts.slice(2).filter(Boolean).join('/')
  return '/#' + p
}

function searchWithout(search, key) {
  try {
    const q = new URLSearchParams(search || '')
    q.delete(key)
    const s = q.toString()
    return s ? `?${s}` : ''
  } catch { return '' }
}
function goParam(search) {
  try { const v = new URLSearchParams(search || '').get('go') || ''; return GO.test(v) ? v : '' } catch { return '' }
}

// 들어온 주소를 바로잡을 곳 — replaceState 로 바꿀 주소, 그대로면 null (react 없음 — 시험이 바로 부른다)
export function canonicalUrl(loc) {
  const pathname = String(loc?.pathname || '/')
  const hash = String(loc?.hash || '')
  const search = String(loc?.search || '')
  const g = gameOfPath(pathname)
  const here = pathname + search + hash
  let to = null
  if (g && hasHash(hash)) {
    // /g/room#/hub — 게임 화면에서 옛 해시 이동(window.location.hash = '/hub')을 한 것: 그 화면의 제 주소로
    const u = urlFor(hash.replace(/^#/, ''))
    to = u.startsWith('/#') ? '/' + search + u.slice(1) : u + search
  } else if (g && !isStandalone(g.id)) {
    // 아직 옮기지 않은 게임 — 예전처럼 해시 주소로 (모르는 게임은 첫 화면)
    const tail = g.rest || goParam(search)
    const base = G_HASH[g.id]
    to = '/' + searchWithout(search, 'go') + '#' + (base ? base + (tail && g.id !== 'judge' ? `/${tail}` : '') : '/')
  } else if (g && g.id !== 'judge' && !g.rest && goParam(search)) {   // 최후의 변론은 도전 조각(go)을 쓰지 않는다
    to = `/g/${g.id}/${goParam(search)}` + searchWithout(search, 'go')
  } else if (!g && (pathname === '/' || pathname === '/index.html') && hasHash(hash)) {
    const u = urlFor(hash.replace(/^#/, ''))
    if (u.startsWith('/g/')) to = u + search
  }
  return to && to !== here ? to : null
}

// 지금 주소 → 화면 { name, id, sub } — /g/<게임> 이면 그 게임, 아니면 해시
export function parseLocation(loc) {
  const g = gameOfPath(loc?.pathname)
  if (g && isStandalone(g.id) && !hasHash(loc?.hash)) {
    if (g.id === 'judge') return g.rest ? parseHash('#/' + g.rest) : { name: 'archive', id: null, sub: null }
    const parts = g.rest.split('/').filter(Boolean)
    return { name: g.id, id: parts[0] ? decode(parts[0]) : null, sub: parts[1] ? decode(parts[1]) : null }
  }
  return parseHash(loc?.hash)
}

// 지금 주소를 옛 해시 꼴로 ('#/room/abc') — 돌아올 곳 저장 · 오류 집계처럼 해시 문자열을 쓰던 곳용
export function appHash(loc) {
  const g = gameOfPath(loc?.pathname)
  if (!(g && isStandalone(g.id) && !hasHash(loc?.hash))) return String(loc?.hash || '')
  const r = parseLocation(loc)
  return '#/' + [r.name, r.id, r.sub].filter((x) => x != null).map((x) => encodeURIComponent(x)).join('/')
}
