// 기기 저장 키 이사 — 게임 기록 키를 '<게임 id>.이름' 으로 모은다 (2026-11-26 허브 유지 + 게임 독립 2단계)
//   옛 키를 읽어 새 키로 옮겨 붙인다(새 키가 비어 있을 때만). 옛 키는 2026-12-10 까지 남긴다(되돌리기 배포 대비) — 그 뒤 첫 방문 때 cleanOldKeys 가 지운다.
//   기기마다 게임별로 한 번만 한다(mg.moved.<게임>) — 다른 계정으로 바꾼 뒤 남은 옛 키가 새 계정 기록에 다시 섞이지 않게
//   계정 쪽 기록(/api/me/games/<게임>)에 옛 키 이름으로 남은 것도 받을 때 새 이름으로 읽는다 (renameRemote — account/sync.js)
//   react 없음 (node --test: tests/platform.test.mjs)
//
// 공용 키 이사 (2026-11 내부 이름 makgan) — aij.settings · aij.session · aij.playerId … → mg.* (SHARED_MOVES)
//   main.jsx 의 맨 첫 import(platform/earlyKeys.js)가 다른 모듈이 저장소를 읽기 '전에' 한 번 옮긴다(mg.moved.shared) — 로그인 · 설정 · 방문자 ID 유지
//   옛 키는 2026-12-26 까지 남기고(되돌리기 배포 대비 — 옛 코드는 옛 키를 읽는다) 그 뒤 첫 방문 때 지운다 (처리방침 12-26 판 8장 '옛 이름' 줄)
//   탭 저장소(sessionStorage)의 aij.invite · aij.challenge · aij.chunk.reload 는 탭을 닫으면 사라지므로 옮기지 않는다

// 공용 키 { 새 키: 옛 키 } — localStorage 만
export const SHARED_MOVES = Object.freeze({
  'mg.settings': 'aij.settings', 'mg.session': 'aij.session', 'mg.playerId': 'aij.playerId', 'mg.guest': 'aij.guest',
  'mg.src': 'aij.src', 'mg.entry': 'aij.entry', 'mg.invite.from': 'aij.invite.from', 'mg.moved': 'aij.moved',
  'mg.hub.last': 'aij.hub.last', 'mg.recovery.todo': 'aij.recovery.todo',
})
export const SHARED_CLEAN_FROM = Date.parse('2026-12-26T00:00:00+09:00')
// 옛 이름 → 새 이름 (옛 주소에서 옮겨 받은 기록을 쓸 때 — move/keys.js applyMoved)
export const SHARED_RENAME = Object.freeze(Object.fromEntries(Object.entries(SHARED_MOVES).map(([to, from]) => [from, to])))

// 게임 id → { 새 키: 옛 키 }. 게임을 옮길 때 한 줄씩 더한다
export const KEY_MOVES = Object.freeze({
  room: Object.freeze({ 'room.v3': 'room3.v1', 'room.mus': 'room3.mus' }),
  future: Object.freeze({ 'future.v3': 'fut3.v1', 'future.mus': 'fut3.mus', 'future.v1': 'fut.v1', 'future.pro': 'fut.pro' }),
  search: Object.freeze({ 'search.v2': 'srch2.v1', 'search.mus': 'srch2.mus', 'search.v1': 'srch.v1', 'search.run.CASE_001': 'srch.run.CASE_001', 'search.run.CASE_002': 'srch.run.CASE_002', 'search.run.CASE_003': 'srch.run.CASE_003', 'search.run.CASE_004': 'srch.run.CASE_004', 'search.run.CASE_005': 'srch.run.CASE_005' }),
  knows: Object.freeze({ 'knows.v3': 'knw3.v1', 'knows.mus': 'knw3.music', 'knows.v1': 'knw.v1', 'knows.h1': 'knw3.h1' }),
  train: Object.freeze({ 'train.v2': 'kyj.train.v2' }),
  beat: Object.freeze({ 'beat.v2': 'kyj.beat.v2', 'beat.bgm': 'kyj.beat.bgm', 'beat.ver': 'kyj.beat.ver' }),
  // 최후의 변론 (2026-11-26) — aij.* 중 이 게임 것만. 공용(mg.settings · mg.playerId · mg.session · mg.guest · mg.src · mg.entry · mg.invite* · mg.challenge · mg.moved · mg.hub.last · mg.recovery.todo · mg.chunk.reload)은 그대로
  judge: Object.freeze(Object.fromEntries(['progress', 'opened', 'courtEntries', 'activeTrial', 'auto', 'cineSeen', 'dareSeen', 'firstRunTrial', 'interviewSeen', 'mode', 'rc.draft', 'soundChip', 'soundTip.off', 'soundTip.shown', 'witnessHint', 'guest.first'].map((k) => ['judge.' + k, 'aij.' + k]))),
})
// 계정과 맞추는 키 — 게임 id 로 시작하는 키만 (튜토리얼 onb.<게임> 포함)
export const SYNC_KEYS = Object.freeze({
  room: Object.freeze(['room.v3', 'room.mus', 'room.v1', 'room.metrics', 'onb.room']),
  future: Object.freeze(['future.v3', 'future.mus', 'future.v1', 'future.pro', 'onb.future']),
  search: Object.freeze(['search.v2', 'search.mus', 'search.v1', 'search.run.CASE_001', 'search.run.CASE_002', 'search.run.CASE_003', 'search.run.CASE_004', 'search.run.CASE_005', 'onb.search']),
  knows: Object.freeze(['knows.v3', 'knows.mus', 'knows.v1', 'onb.knows']),   // knows.h1(반응 습관 요약)은 이 기기에만 — 계정에 올리지 않는다
  train: Object.freeze(['train.v2', 'onb.train']),
  beat: Object.freeze([]),   // 도마 박자 기록은 이 기기에만 (처리방침 8장 BEAT_KEYS 줄) — 계정과 맞추지 않는다
  judge: Object.freeze([]),   // 최후의 변론은 GameSync(덮어쓰기)가 아니라 judgeProgress.js 가 합쳐 올린다(SELF_SYNC) — 여기는 비움
})
// 이름 앞부분째 옮기는 키 — 사건 · 재판마다 하나씩 생기는 기록 (새 앞부분 → 옛 앞부분)
export const PREFIX_MOVES = Object.freeze({
  judge: Object.freeze(Object.fromEntries(['note.', 'found.', 'seen.', 'probes.', 'truthSeen.', 'lastTier.', 'rc.brief.', 'apparition.'].map((p) => ['judge.' + p, 'aij.' + p]))),
})
// 이 기기에 지금 있는 키로 { 새 키: 옛 키 } 를 펼친다 (정확한 이름 + 앞부분째 옮기는 것)
export function expandMoves(game, storage = local()) {
  const out = { ...(KEY_MOVES[game] || {}) }
  const pre = PREFIX_MOVES[game]
  if (pre && storage) {
    try {
      const keys = []
      for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k != null) keys.push(k) }
      for (const [to, from] of Object.entries(pre)) for (const k of keys) if (k.startsWith(from)) out[to + k.slice(from.length)] = k
    } catch { /* 저장소 목록을 못 읽음 — 정확한 이름만 */ }
  }
  return Object.keys(out).length ? out : null
}

const DONE = (game) => `mg.moved.${game}`

function local() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}

// 옛 키 → 새 키 (한 번만). 옮긴 키 이름 목록을 돌려준다. 저장소를 못 쓰면 []
export function moveKeys(game, storage = local(), moves = expandMoves(game, storage)) {
  if (!storage || !moves) return []
  const moved = []
  try {
    if (storage.getItem(DONE(game))) return []
    for (const [to, from] of Object.entries(moves)) {
      const old = storage.getItem(from)
      if (old != null && storage.getItem(to) == null) {
        storage.setItem(to, old)
        moved.push(to)
      }
    }
    storage.setItem(DONE(game), '1')
  } catch { /* 저장소가 꽉 찼거나 막힘 — 다음에 다시 (표시를 못 남겼으니) */ }
  return moved
}

// 옛 키 지우기 — 2026-12-10(한국 시간) 이후 첫 방문 때부터, 새 키에 값이 있는 옛 키만 지운다 (사용자 결정 11/26: 되돌리기 대비 기간 뒤 정리)
//   새 키가 비어 있는 옛 키는 남긴다(옮기지 못한 기록 — 다음 방문에 moveKeys 가 다시 볼 수 없으므로 잃지 않게 그대로). 지운 키 이름 목록을 돌려준다
export const CLEAN_FROM = Date.parse('2026-12-10T00:00:00+09:00')
export function cleanOldKeys(game, storage = local(), moves = expandMoves(game, storage), now = Date.now()) {
  if (!storage || !moves || now < CLEAN_FROM) return []
  const gone = []
  try {
    for (const [to, from] of Object.entries(moves)) {
      if (storage.getItem(from) != null && storage.getItem(to) != null) {
        storage.removeItem(from)
        gone.push(from)
      }
    }
  } catch { /* 저장소 막힘 — 다음 방문에 다시 */ }
  return gone
}

// 공용 키 — 옛 aij.* 를 mg.* 로 (한 번만 · 새 키가 비어 있을 때만), 2026-12-26 뒤에는 옛 키를 지운다. 옮긴 키 이름 목록
//   지우기는 '옮기기를 마친 기기'(mg.moved.shared)에서 옛 키 전부 — 로그아웃으로 새 키가 없어진 옛 로그인도 남기지 않는다
export function tidySharedKeys(storage = local(), now = Date.now()) {
  const moved = moveKeys('shared', storage, SHARED_MOVES)
  if (!storage || now < SHARED_CLEAN_FROM) return moved
  try {
    if (storage.getItem(DONE('shared'))) for (const from of Object.values(SHARED_MOVES)) storage.removeItem(from)
  } catch { /* 저장소 막힘 — 다음 방문에 다시 */ }
  return moved
}

// 앱이 열릴 때 한 번 — 모든 게임의 옛 키를 새 키로 옮기고(한 번만), 정리 날짜가 지났으면 옛 키를 지운다 (main.jsx)
export function tidyAllKeys(storage = local(), now = Date.now()) {
  for (const game of Object.keys(KEY_MOVES)) {
    moveKeys(game, storage)
    cleanOldKeys(game, storage, expandMoves(game, storage), now)
  }
}

// 계정에 저장된 기록(키 → 글) 중 옛 키 이름을 새 이름으로 — 새 이름 값이 있으면 그것이 먼저
export function renameRemote(game, data, moves = KEY_MOVES[game]) {
  if (!data || typeof data !== 'object' || !moves) return data
  const out = { ...data }
  for (const [to, from] of Object.entries(moves)) {
    if (out[to] == null && typeof out[from] === 'string') out[to] = out[from]
  }
  return out
}

// 기기에만 두는 키 (계정에 올리지 않음 — 처리방침 8장 DEVICE_ONLY_KEYS)
export const DEVICE_ONLY = Object.freeze({
  knows: Object.freeze(['knows.h1']), beat: Object.freeze(['beat.v2', 'beat.bgm', 'beat.ver']),
  judge: Object.freeze(Object.keys(KEY_MOVES.judge).filter((k) => k !== 'judge.progress' && k !== 'judge.opened')),
})
// 게임이 스스로 계정과 맞추는 키 (GameSync 가 아니라 합치기 — 최후의 변론 judgeProgress.js syncJudgeProgress)
export const SELF_SYNC = Object.freeze({ judge: Object.freeze(['judge.progress', 'judge.opened']) })

export const syncKeys = (game) => SYNC_KEYS[game] || []
