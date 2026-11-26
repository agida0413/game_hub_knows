// 이 기기의 게임 기록은 누구 것인가 — 같은 기기에서 다른 계정으로 들어와도 앞 계정의 기록이 새 계정에 섞이지 않게 (2026-11-24 감사)
//   기기 저장소(localStorage)의 게임 기록은 계정과 상관없이 한 칸이다. 그래서 주인을 따로 적어 둔다.
//     hub.owner            이 기기 기록을 마지막으로 계정과 맞춘 계정 ID (없으면 아직 손님 기록)
//     hub.sync.<게임>.by   그 게임의 동기화 표시(hub.sync.<게임>)를 남긴 계정 ID (account/sync.js syncGame)
//   규칙
//     · 처음 로그인(주인 없음) — 손님일 때 한 기록을 이 계정으로 가져간다 (손님 → 가입 이관, 지금처럼)
//     · 같은 계정 — 그대로
//     · 다른 계정 — 화면이 바로 읽는 기록(최후의 변론 진행 · 열린 사건 · 허브 최근/즐겨찾기 등)을 지우고,
//       게임별 동기화 기록은 그 게임을 열 때 지운 뒤 새 계정의 기록을 받아 온다 (앞 계정 기록은 서버의 앞 계정에 남아 있다)
//   지우지 않는 것: 소리 · 화면 설정, 방문자 ID, 손님 토큰, 운영자 미리보기 스위치, 마지막 게임, 안내를 본 표시
//   react 없음 — node --test 로 시험한다 (tests/account-owner.test.mjs)

export const OWNER_KEY = 'hub.owner'
export const markKey = (game) => `hub.sync.${game}`        // 이 기기가 마지막으로 맞춘 계정 시각 (syncGame)
export const markOwnerKey = (game) => `hub.sync.${game}.by` // 그 시각을 남긴 계정
const MARK_RE = /^hub\.sync\.([a-z][a-z0-9]{1,15})$/
const UNKNOWN = '?'                                         // 주인을 모르는 옛 동기화 표시 (이 감사 전에 남은 것)

// 계정이 바뀌면 바로 지우는 기록 — 화면이 동기화 전에 기기 저장소에서 바로 읽는 것
export const PERSONAL_KEYS = [
  'judge.progress', 'judge.opened',      // 최후의 변론 — 해결 · 별 · 열린 사건 (judgeProgress.js)
  'judge.activeTrial', 'judge.courtEntries', // 이어서 재판 · 법정 출두 수
  'aij.progress', 'aij.opened', 'aij.activeTrial', 'aij.courtEntries',   // 위의 옛 이름 (2026-12-10 뒤 정리될 때까지 — 2026-11-26 게임 id 로 묶음)
  'mg.recovery.todo',                   // '복구 코드를 받아 두세요' 안내 (앞 계정의 것)
  'hub.recent', 'hub.fav',               // 허브 최근 플레이 · 즐겨찾기 (hub/games.js)
]
export const PERSONAL_PREFIXES = ['judge.note.', 'judge.found.', 'judge.seen.', 'judge.probes.', 'judge.truthSeen.',
  'aij.note.', 'aij.found.', 'aij.seen.', 'aij.probes.', 'aij.truthSeen.']   // 둘째 줄은 옛 이름 (2026-12-10 뒤 정리될 때까지)

const S = (storage) => storage || globalThis.localStorage
function get(storage, k) { try { return S(storage).getItem(k) } catch { return null } }
function set(storage, k, v) { try { S(storage).setItem(k, v) } catch { /* 저장 불가 — 이번 화면에서만 */ } }
function del(storage, k) { try { S(storage).removeItem(k) } catch { /* 저장 불가 */ } }
function allKeys(storage) {
  const st = S(storage)
  const out = []
  try {
    for (let i = 0; i < st.length; i++) { const k = st.key(i); if (k != null) out.push(k) }
  } catch { /* 저장소 없음 */ }
  return out
}

// 주인 바뀜 — 화면이 바로 읽는 기록을 지우고, 게임별 동기화 표시에 앞 주인을 적어 둔다(그 게임을 열 때 syncGame 이 지운다)
function handOver(prev, storage) {
  const keys = allKeys(storage)
  for (const k of PERSONAL_KEYS) del(storage, k)
  for (const k of keys) if (PERSONAL_PREFIXES.some((p) => k.startsWith(p))) del(storage, k)
  staleMarks(prev, storage, keys)
}
function staleMarks(owner, storage, keys = allKeys(storage)) {
  let n = 0
  for (const k of keys) {
    const m = MARK_RE.exec(k)
    if (m && !get(storage, markOwnerKey(m[1]))) { set(storage, markOwnerKey(m[1]), owner); n += 1 }
  }
  return n
}

// 로그인이 정해질 때마다 부른다 (auth.js — 저장된 로그인을 읽을 때 · 가입 · 복구 · 갱신)
//   fresh: 가입 · 복구로 방금 들어왔다 — 주인 표시가 없는데 옛 동기화 표시만 있으면 누구 것인지 모르므로 그 게임은 계정 기록을 새로 받는다
//   돌려주는 값: 'same' · 'first' · 'switched' · null(계정 없음)
export function claimDevice(userId, { fresh = false } = {}, storage) {
  if (!userId) return null
  const prev = get(storage, OWNER_KEY)
  if (prev === userId) return 'same'
  if (prev) handOver(prev, storage)
  else if (fresh) staleMarks(UNKNOWN, storage)
  set(storage, OWNER_KEY, userId)
  return prev ? 'switched' : 'first'
}

// 게임 화면이 열려 동기화를 시작할 때 (syncGame) — 그 게임 기록을 다른 계정이 남겼으면 지운다 → 'wiped' | 'ok'
export function adoptGame(game, keys, userId, storage) {
  const by = get(storage, markOwnerKey(game))
  if (!by || by === userId) return 'ok'
  for (const k of keys || []) del(storage, k)
  del(storage, markKey(game))
  del(storage, markOwnerKey(game))
  return 'wiped'
}

// 이 기기 기록이 지금 이 계정 것인가 — 다른 탭에서 다른 계정으로 바꿨으면(저장소는 탭끼리 같이 쓴다) 이 탭은 올리지 않는다
export function ownsDevice(userId, storage) {
  const o = get(storage, OWNER_KEY)
  return !!userId && (!o || o === userId)
}

export const readMark = (game, storage) => get(storage, markKey(game)) || ''
export function writeMark(game, userId, at, storage) {
  set(storage, markKey(game), at || '')
  if (userId) set(storage, markOwnerKey(game), userId)
}

// 회원 탈퇴 — 주인 표시는 남긴다(다음에 누가 들어오든 '다른 계정'으로 보고 남은 게임 기록을 지우게), 게임별 표시에도 주인을 적는다
export function leaveDevice(userId, storage) {
  if (!userId) return
  for (const k of PERSONAL_KEYS) del(storage, k)
  set(storage, OWNER_KEY, userId)
  staleMarks(userId, storage)
}
