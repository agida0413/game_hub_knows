// 게임 목록 — 허브(첫 화면)가 아는 것은 이것뿐이다 (게임 내부 코드는 가져오지 않는다)
//   나중에 게임을 독립 서비스로 떼어 내면 entry 를 그 서비스 주소(https://…)로 바꾸면 끝.
//   status (2026-11-24 사용자 지시 — 세 가지): live = 서비스(누구나) · maint = 점검 중(잠금) · soon = 준비 중(잠금)
//     점검 중 · 준비 중은 카드에 표시만 하고 잠근다. 운영자는 표시는 같게 보되 들어갈 수 있다(제약 없이 — ProtoGate · GameGate)
//   배열 순서 = 노출 순서 (서비스: 도마 박자 · 최후의 변론 · 최근 검색어 · 다들 언제 돼? · 10초 뒤의 나 · AI KNOWS YOU)
export const GAMES = [
  {
    id: 'knows',
    title: 'AI KNOWS YOU',
    en: 'AI KNOWS YOU',
    tagline: '당신이 고르기 전에, AI 는 답을 봉인해 둔다 — 20번의 선택으로 벌이는 3~5분 심리전',
    short: '고르기 전에, AI 는 답을 봉인한다',
    categories: ['심리'],
    time: '3~5분',
    image: '/knows/img/cover.webp',    // 카드 사진 — 「숨긴 사진」 표지
    tone: 'cold',
    status: 'live',               // 정식 공개 (2026-11-24 — 새 판, 로그인 없이 누구나)
    entry: '#/knows',
  },
]

// 마지막으로 고른 게임 — 다시 들어오면 허브를 건너뛰고 바로 그 게임으로 (기기별)
const LAST = 'mg.hub.last'
export function lastGame() {
  try {
    const v = localStorage.getItem(LAST)
    if (v) return v
    // 허브 이전부터 최후의 변론을 하던 기기 — 실제로 해 본 흔적(진행 기록 · 법정 출두)이 있으면 이미 고른 것으로 보고 허브를 건너뛴다
    //   (방문자 ID · 설정처럼 처음 열자마자 생기는 값은 보지 않는다 — 새 방문자가 허브를 못 보게 되므로)
    //   로그인(mg.session)은 보지 않는다 — 2026-11-23 부터 계정은 허브 공용이라, 허브에서 가입만 한 사람이 다음에 최후의 변론으로 끌려갔다 (11-24 감사)
    if (['judge.progress', 'judge.courtEntries', 'aij.progress', 'aij.courtEntries'].some((k) => localStorage.getItem(k))) return 'judge'   // 새 이름 · 옛 이름 (2026-11-26)
    return null
  } catch { return null }
}
export function rememberGame(id) {
  try { localStorage.setItem(LAST, id) } catch { /* 저장 불가 — 매번 허브에서 고르면 된다 */ }
}

// 운영자 — 이 계정(허브 로그인)은 '준비 중' 게임 카드를 눌러 들어갈 수 있다 (2026-11-23 사용자 지시: 운영자 = 운영자)
//   운영 서버의 EARLY_ACCESS_USERS 와 같은 계정. 게임 주소는 원래 열려 있으니 허브 카드만 다르게 보이는 것
// 운영자 계정 id — 빌드 때 VITE_OPERATORS(쉼표)로 넣는다. 운영자는 '준비 중' · '점검 중' 게임에도 들어갈 수 있다
const OPS_ENV = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OPERATORS) || ''
export const OPERATORS = OPS_ENV.split(',').map((s) => s.trim()).filter(Boolean)
export const isOperator = (user) => !!user && OPERATORS.includes(user.id)

// ------------------------------------------------------------------ 허브 화면용 순수 도우미 (react 없음 — node --test)
// 게임 목록 · 카드는 운영자도 일반 사용자와 같다 (2026-11-24 사용자 지시). 다른 것은 '준비 중' 카드를 눌렀을 때 — 운영자 계정(preview)만 들어간다
//   status 'live' = 정식 · 'soon' = 준비 중 (카드는 모두에게 · 들어가기는 운영자만)
export const isPrep = (g) => g.status !== 'live' && !g.previewOnly   // 잠긴 게임(점검 중 + 준비 중)
export const statusFor = (g, preview) => (preview ? 'live' : g.status)
// 카드 · 알림 글 — 서비스는 빈 글, 점검 중 · 준비 중 (운영자도 같은 글을 본다)
export const STATUS_LABEL = { live: '', maint: '점검 중', soon: '준비 중' }
export const statusLabel = (g) => STATUS_LABEL[g.status] ?? '준비 중'
// 허브에 보이는 게임 — 시제품(previewOnly)은 운영자에게도 안 보인다 (지금 해당하는 게임 없음)
export const shownGames = (_preview = false, games = GAMES) => games.filter((g) => !g.previewOnly)

// 카테고리 칩 — '전체' + 게임들에 붙은 순서대로 (중복 없이)
export const ALL = '전체'
export function categoriesOf(games = GAMES) {
  const out = [ALL]
  for (const g of games) for (const c of g.categories || []) if (!out.includes(c)) out.push(c)
  return out
}
export function filterGames(cat, games = GAMES) {
  return !cat || cat === ALL ? games : games.filter((g) => (g.categories || []).includes(cat))
}

// 처음 온 기기의 추천 게임 — 2026-11-24 밤 사용자 노출 순서(도마 박자가 첫째)로 바꿈 (옛: 다들 언제 돼?). 돌아온 기기도 featured(도마 박자)
export const NEWCOMER_PICK = 'beat'
// 처음 온 기기 — 허브에서 고른 게임도, 최근 기록도, 최후의 변론 흔적도 없다 (허브가 열릴 때 한 번만 읽는다 — 한 판 하고 와도 그 화면에서는 안 바뀜)
export function isNewcomer() {
  try { return !lastGame() && readIds(RECENT).length === 0 } catch { return false }
}

// 추천 게임 — featured 이면서 열 수 있는 것, 없으면 첫 공개 게임, 그것도 없으면 첫 게임 (시제품은 미리보기에서만)
//   first(처음 온 기기)면 NEWCOMER_PICK 이 열려 있을 때 그것
export function featuredGame(preview = false, games = GAMES, first = false) {
  const shown = shownGames(preview, games)
  const live = shown.filter((g) => g.status === 'live')   // 준비 중 게임은 추천 · 배너에 넣지 않는다
  return (first && live.find((g) => g.id === NEWCOMER_PICK)) || live.find((g) => g.featured) || live[0] || shown[0] || null
}

// 최근 플레이 · 즐겨찾기 — 기기에 저장, 로그인하면 계정 확장 정보(/api/me/games/hub)로 동기화 (Hub.jsx 의 syncGame)
export const RECENT = 'hub.recent'
export const FAV = 'hub.fav'
export const HUB_SYNC_KEYS = [RECENT, FAV]
const RECENT_MAX = 6
function readIds(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch { return [] }
}
function writeIds(key, ids) {
  try { localStorage.setItem(key, JSON.stringify(ids)) } catch { /* 저장 불가 — 이번 화면에서만 */ }
  return ids
}
const known = (ids, games) => ids.map((id) => games.find((g) => g.id === id)).filter(Boolean)
export const recentGames = (games = GAMES) => known(readIds(RECENT), games)
export const favoriteGames = (games = GAMES) => known(readIds(FAV), games)
export const isFavorite = (id) => readIds(FAV).includes(id)
export function pushRecent(id) {
  return writeIds(RECENT, [id, ...readIds(RECENT).filter((x) => x !== id)].slice(0, RECENT_MAX))
}
export function toggleFavorite(id) {
  const ids = readIds(FAV)
  return writeIds(FAV, ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
}
