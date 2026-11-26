// 이용약관 · 개인정보 처리방침의 판(版) — 시행일(한국 시간 0시)부터 그 판이 적용된다 (react 없음 — tests/legal-privacy.test.mjs 가 바로 시험)
//   바꿀 때: 새 판을 목록 끝에 더하고 옛 판은 지우지 않는다 → 이전 판은 #/privacy/<판 id> 로 누구나 볼 수 있다
//   시행일 규칙 (처리방침 11장 · 약관 제9조): 시행 7일 전부터 서비스 화면에 알리고, 이용자에게 불리한 변경은 30일 전부터
//   2026-12-26 판: 허브 '막간' 개편으로 새로 생긴 수집 항목 · 공개(주간 랭킹)를 채운다 → 불리한 변경으로 보고 30일 규칙
export const EDITIONS = Object.freeze({
  privacy: ['2026-11-22', '2026-12-26'],
  terms: ['2026-11-22', '2026-12-26'],
})

// 이번 개정 안내를 늦어도 이날부터 화면에 보인다 — 배포가 이보다 늦어지면 새 판의 시행일도 그만큼 늦춘다 (시험이 30일을 확인)
export const NOTICE_FROM = '2026-11-26'

// 처리방침 8장의 '로그인하면 계정에도 저장' 줄에 적는 기기 저장 키 — 이름 그대로이거나, 점(.)으로 끝나면 그 이름으로 시작하는 것 모두
//   App.jsx GameSync · 최후의 변론(judgeProgress) 이 계정으로 올리는 키는 모두 여기에 걸려야 한다 (tests/legal-privacy.test.mjs)
//   새 게임이 동기화 키를 더하면 여기에 더하고, 처리방침이 바뀌는 것이므로 판(EDITIONS) 규칙도 함께 본다
//   2026-11-26 허브 유지 + 게임 독립: 게임 기록 키를 게임 id 로 묶었다(room. · future. · search. · knows. · train. · beat.) — 옛 이름은 LEGACY_GAME_KEYS 줄로 따로 적고,
//     새 이름으로 옮겨 붙인 뒤 2026-12-10 이후 첫 방문 때 지운다(platform/keys.js cleanOldKeys). 처리방침 12-26 판은 새 이름 기준
//   knows.h1(「AI KNOWS YOU」 반응 습관 요약 숫자)은 계정에 올리지 않는다 — 기기에만 → DEVICE_ONLY_KEYS 줄
export const SYNCED_GAME_KEYS = Object.freeze(['judge.progress', 'judge.opened', 'room.', 'future.', 'search.', 'knows.v3', 'knows.mus', 'knows.v1', 'train.v2', 'onb.'])
export const DEVICE_ONLY_KEYS = Object.freeze(['knows.h1'])
// 「도마 박자」 기기 기록 — 이 기기에만 (계정에 올리지 않음)
export const BEAT_KEYS = Object.freeze(['beat.v2', 'beat.bgm', 'beat.ver'])
// 옛 이름 — 위 기록의 바뀌기 전 이름. 이 기기에만 남아 있다가 새 이름으로 옮겨 붙인 뒤 2026-12-10 이후 첫 방문 때 지운다 (주소 이사 때는 함께 옮겨진다)
export const LEGACY_GAME_KEYS = Object.freeze(['aij.progress', 'aij.opened', 'aij.note.', 'aij.found.', 'aij.seen.', 'aij.probes.', 'aij.truthSeen.', 'aij.courtEntries', 'aij.activeTrial', 'room3.', 'fut.', 'fut3.', 'srch.', 'srch2.', 'knw.', 'knw3.', 'kyj.train.v2', 'kyj.beat.'])
export const LEGACY_UNTIL = '2026-12-10'
// 옛 이름 — 공용 쿠키 · 키의 바뀌기 전 이름 (2026-11 내부 이름 makgan 바꾸기 · platform/keys.js SHARED_MOVES 와 같은 목록 — 시험이 대조)
//   새 이름(mg_rt · mg.*)으로 옮겨 붙이고 2026-12-26 이후 첫 방문 때 지운다 (쿠키는 그 뒤 로그인을 갱신할 때 — auth_service LEGACY_COOKIE_UNTIL)
export const LEGACY_SHARED_KEYS = Object.freeze(['aij_rt', 'aij.session', 'aij.guest', 'aij.playerId', 'aij.settings', 'aij.src', 'aij.entry', 'aij.invite.from', 'aij.hub.last', 'aij.recovery.todo', 'aij.moved'])
export const LEGACY_SHARED_UNTIL = '2026-12-26'
export const syncedKeyListed = (key, list = SYNCED_GAME_KEYS) => list.some((p) => (p.endsWith('.') ? key.startsWith(p) : key === p))

const ID = /^(\d{4})-(\d{2})-(\d{2})$/
export const isEditionId = (s) => ID.test(String(s || ''))
export const startOf = (id) => Date.parse(`${id}T00:00:00+09:00`)

export function labelOf(id) {
  const m = ID.exec(id)
  return m ? `${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일` : ''
}
export function shortLabel(id) {
  const m = ID.exec(id)
  return m ? `${Number(m[2])}월 ${Number(m[3])}일` : ''
}
// 그 판이 끝나는 날 (다음 판 시행일의 전날)
export function dayBefore(id) {
  const m = ID.exec(id)
  if (!m) return ''
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - 1))
  return d.toISOString().slice(0, 10)
}

// 지금 날짜로 — current: 시행 중인 판 · next: 안내 중인 다음 판(없으면 null) · shown: 보여 줄 판(want 가 있는 판이면 그것) · past: 지난 판
export function editionsAt(ids, now = Date.now(), want = null) {
  const live = ids.filter((id) => startOf(id) <= now)
  const current = live.length ? live[live.length - 1] : ids[0]
  const next = ids.find((id) => startOf(id) > now) || null
  const shown = want && ids.includes(want) ? want : current
  return { current, next, shown, past: live.slice(0, -1) }
}

// 지금 안내 중인 변경 중 가장 이른 시행일 (없으면 null) — 약관 · 처리방침 링크 줄(LegalLinks)이 '○월 ○일 변경 예정'을 붙인다
export function upcomingChange(now = Date.now(), editions = EDITIONS) {
  const next = Object.values(editions).map((ids) => editionsAt(ids, now).next).filter(Boolean).sort()
  return next[0] || null
}
