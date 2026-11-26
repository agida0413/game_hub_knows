// 공통 온보딩(튜토리얼) — 홈의 모든 게임이 같이 쓴다 (2026-11-23 사용자 지시: 설명형 대신 '해 보면서 배우는' 30~60초 튜토리얼)
//   원칙: 첫 10초 재미 · 30초 안에 첫 행동 · 1분 안에 핵심 규칙 · 끝나면 바로 본 게임
//   · 실제 버튼 하나만 밝히고 나머지는 어둡게(Tour) 또는 게임 안 한 줄 + 손가락(Coach)
//   · 진행 표시 · '건너뛰기' 항상 · 다시 보기('?') · 완료 여부 저장(onb.<game>, 계정 동기화 키로도 씀)
//   · 단계별 기록(시작 · 단계 · 완료 · 건너뜀) — 기기 지표 onb.metrics + 'onboarding' 이벤트(App.jsx 가 받아 서버로 보냄)
//   설계: reports/tutorial_design.md 2장. react 를 불러오지 않는다(시험이 그대로 불러 씀).
const KEY = (game) => `onb.${game}`
const METRICS = 'onb.metrics'

// 결정 값 — 사용자 확인 전 추천안. 바뀌면 여기 한 곳만 고친다
//   syncAccount: 로그인한 사람은 계정 동기화 키(onb.<게임>, 처리방침 8장에 이미 적힘)에 본 표시를 둔다. 손님은 기기에
//     (동기화 자체는 각 게임이 GameSync 목록에 onb.<게임> 을 넣어 켠다 - 여기 값은 그 약속을 적어 둔 것)
//   skipIfPlayed: 그 게임을 이미 해 본 기록이 있는 사람에게는 자동으로 안 띄운다('?' 로는 언제든)
export const TUTORIAL_POLICY = { syncAccount: true, skipIfPlayed: true }

export function tourState(game) {
  try { return JSON.parse(localStorage.getItem(KEY(game))) || null } catch { return null }
}
// 이 버전의 튜토리얼을 끝냈거나 건너뛰었으면 다시 띄우지 않는다
export function tourDone(game, version = 1) {
  const s = tourState(game)
  return !!s && (s.tutorialCompleted || s.skipped) && (s.tutorialVersion || 1) >= version
}
export function saveTour(game, patch) {
  const next = { tutorialVersion: 1, lastStep: 0, ...(tourState(game) || {}), ...patch }
  try { localStorage.setItem(KEY(game), JSON.stringify(next)) } catch { /* 저장 불가 — 이번 방문만 */ }
  return next
}
// 다시 보기 — 다음에 그 화면을 열 때 처음부터
export function resetTour(game) {
  try { localStorage.removeItem(KEY(game)) } catch { /* 저장 불가 */ }
}

// ---- 저장소 어댑터: 모두 { read(), write(patch), reset() } ----
//   값 모양: { tutorialVersion, tutorialCompleted, skipped, lastStep, completedAt, seen: ['짚기 이름'], parts: { 부분: 'done' | 'skip' }, first }
const mergeVal = (old, patch) => {
  const next = { ...(old || {}), ...patch }
  if (patch && patch.parts) next.parts = { ...((old && old.parts) || {}), ...patch.parts }
  return next
}

// 공개 게임 — localStorage 'onb.<game>' (계정 동기화 키)
export function onbStore(game) {
  return {
    key: KEY(game),
    read: () => tourState(game),
    write: (patch) => {
      const next = { tutorialVersion: 1, lastStep: 0, ...mergeVal(tourState(game), patch) }
      try { localStorage.setItem(KEY(game), JSON.stringify(next)) } catch { /* 저장 불가 */ }
      return next
    },
    reset: () => resetTour(game),
  }
}

// 준비 중 게임 — 'kyj.tim.p2' 같은 기존 저장 덩어리 안의 field 하나만 읽고 쓴다(같은 덩어리의 음악 · 기록은 그대로). 기기에만
export function fieldStore(key, field) {
  const load = () => { try { return JSON.parse(localStorage.getItem(key)) || {} } catch { return {} } }
  const save = (all) => { try { localStorage.setItem(key, JSON.stringify(all)) } catch { /* 저장 불가 */ } }
  return {
    key,
    read: () => { const v = load()[field]; return v && typeof v === 'object' ? v : null },
    write: (patch) => {
      const all = load()
      const next = mergeVal(all[field], patch)
      all[field] = next
      save(all)
      return next
    },
    reset: () => {
      const all = load()
      if (!(field in all)) return
      delete all[field]
      save(all)
    },
  }
}

// 자동으로 띄울지: 이 판 이상을 끝냈거나 건너뛴 기록이 없고(+ 해 본 기록 정책)
export function shouldShow(store, version = 1, { already = false } = {}) {
  let s = null
  try { s = store.read() } catch { s = null }
  if (s && (s.tutorialCompleted || s.skipped) && (s.tutorialVersion || 1) >= version) return false
  if (already && TUTORIAL_POLICY.skipIfPlayed) return false
  return true
}
export function resetStore(store) {
  try { store.reset() } catch { /* 저장 불가 */ }
}
// 화면(part) 단위 상태 — 최후의 변론처럼 한 게임 안 여러 화면: 'done' | 'skip' | null
export function partState(store, part) {
  let s = null
  try { s = store.read() } catch { s = null }
  return (s && s.parts && s.parts[part]) || null
}

// Tour 대상: data-onb 속성 (클래스는 자주 바뀌므로 안정된 이름으로)
export const onbTarget = (name) => `[data-onb="${name}"]`

// ---- 지표 이름 (서버 규칙 ab<번호>_<갈래>_<값>, 영소문자 · 숫자 12자 이내) ----
export const AB_REPLAY = 'ab80_tour_replay'
export const firstLabel = (ms) => `ab81_first_${ms <= 5000 ? 't5' : ms <= 10000 ? 't10' : ms <= 20000 ? 't20' : ms <= 30000 ? 't30' : 't99'}`

// 단계별 이탈을 볼 수 있게 — {game: {start, done, skip, steps: {0: n, 1: n …}}}
//   event: 'start' | 'step' | 'done' | 'skip' | ab 이름(AB_REPLAY · firstLabel)
export function track(game, event, step) {
  try {
    const m = JSON.parse(localStorage.getItem(METRICS) || '{}')
    const g = m[game] || (m[game] = { start: 0, done: 0, skip: 0, steps: {} })
    if (event === 'step') g.steps[step] = (g.steps[step] || 0) + 1
    else g[event] = (g[event] || 0) + 1
    localStorage.setItem(METRICS, JSON.stringify(m))
  } catch { /* 지표 저장 불가 */ }
  try { window.dispatchEvent(new CustomEvent('onboarding', { detail: { game, event, step } })) } catch { /* 이벤트 불가 */ }
}
export function tourMetrics() {
  try { return JSON.parse(localStorage.getItem(METRICS) || '{}') } catch { return {} }
}
