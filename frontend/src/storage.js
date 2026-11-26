// 브라우저 저장소 (진행 기록 · 설정 · 튜토리얼). 사생활 보호 모드 등에서 실패해도 게임은 계속된다.

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 저장 불가 — 무시 */
  }
}

// ------------------------------------------------------------------ 설정
const SETTINGS_KEY = 'mg.settings'
const DEFAULT_SETTINGS = { sfx: true, ambient: true, volume: 0.6, bgmVolume: 0.7, scare: 'full', textSpeed: 'normal', reduceMotion: false }
export const getSettings = () => {
  const s = { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) }
  delete s.shareActivity      // 끝낸 '내 활동 보이기'(2026-11-24) — 예전 값은 읽지 않고, 다음에 설정을 저장할 때 이 기기에서도 사라진다
  return s
}
export const saveSettings = (s) => {
  write(SETTINGS_KEY, s)
  window.dispatchEvent(new CustomEvent('mg:settings', { detail: s }))
}

// ------------------------------------------------------------------ 사건별 진행 기록
const PROGRESS_KEY = 'judge.progress'
const GRADE_RANK = { S: 5, A: 4, B: 3, C: 2, D: 1 }
export const getProgress = () => read(PROGRESS_KEY, {})
export function recordResult(caseId, { won, grade, score, role, trialId, evidenceFound }) {
  const all = getProgress()
  const p = all[caseId] || { plays: 0, wins: 0 }
  p.plays += 1
  if (won) p.wins += 1
  if (!p.bestGrade || GRADE_RANK[grade] > GRADE_RANK[p.bestGrade]) p.bestGrade = grade
  p.bestScore = Math.max(p.bestScore || 0, score)
  p.lastRole = role
  p.lastTrialId = trialId
  p.evidenceFound = Math.max(p.evidenceFound || 0, evidenceFound || 0)
  p.solvedAt = new Date().toISOString()
  // 편마다 판결 결과 — 해결 · 별(이긴 편마다) 계산용 (judgeProgress.js). 승소가 한 번이라도 있으면 승소로 남긴다
  if (role === 'prosecution' || role === 'defense') {
    p.roles = { ...(p.roles || {}) }
    if (won) p.roles[role] = 'win'
    else if (!p.roles[role]) p.roles[role] = 'done'
  }
  all[caseId] = p
  write(PROGRESS_KEY, all)
}

// ------------------------------------------------------------------ 튜토리얼

// ------------------------------------------------------------------ 메모 (재판별 수사 메모)
export const getNote = (trialId) => read(`judge.note.${trialId}`, '')
export const saveNote = (trialId, text) => write(`judge.note.${trialId}`, text)

// ------------------------------------------------------------------ 사진 조사 (사건별로 찾은 관찰 포인트)
const FOUND_KEY = (caseId) => `judge.found.${caseId}`
export const getFound = (caseId) => read(FOUND_KEY(caseId), [])
export function markFound(caseId, spotId) {
  const list = getFound(caseId)
  if (list.includes(spotId)) return list
  const next = [...list, spotId]
  write(FOUND_KEY(caseId), next)
  window.dispatchEvent(new CustomEvent('mg:found', { detail: { caseId, list: next } }))
  return next
}

// ------------------------------------------------------------------ 열람한 증거 (사건별)
const SEEN_KEY = (caseId) => `judge.seen.${caseId}`
export const getSeen = (caseId) => read(SEEN_KEY(caseId), [])
export function markSeen(caseId, evidenceId) {
  const list = getSeen(caseId)
  if (!list.includes(evidenceId)) write(SEEN_KEY(caseId), [...list, evidenceId])
}

// ------------------------------------------------------------------ 사진 조사 횟수 (사건+사진별로 출두 전·후 공유)
const PROBES_KEY = (caseId, mediaKey) => `judge.probes.${caseId}.${mediaKey}`
export function getProbesLeft(caseId, mediaKey, initial) {
  if (!caseId || !mediaKey) return initial
  const stored = read(PROBES_KEY(caseId, mediaKey), null)
  return stored !== null ? stored : initial
}
export function saveProbesLeft(caseId, mediaKey, n) {
  if (!caseId || !mediaKey) return
  write(PROBES_KEY(caseId, mediaKey), n)
}

// ------------------------------------------------------------------ 법정 대사 자동 넘김
export const getAuto = () => read('judge.auto', false)
export const setAuto = (on) => write('judge.auto', !!on)

// ------------------------------------------------------------------ 사건 조사 세션 초기화 (사건 선택 화면으로 돌아갈 때)
export function clearCaseSession(caseId) {
  try {
    const prefix = `judge.probes.${caseId}.`
    const toDelete = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(prefix)) toDelete.push(k)
    }
    toDelete.forEach((k) => localStorage.removeItem(k))
    localStorage.removeItem(`judge.seen.${caseId}`)
    localStorage.removeItem(`judge.found.${caseId}`)
    window.dispatchEvent(new CustomEvent('mg:found', { detail: { caseId, list: [] } }))
  } catch {
    /* 무시 */
  }
}

// ------------------------------------------------------------------ 법정 출두 수 (재판 모드를 고른 횟수) — 첫 1~2판은 입문 재판을 권한다
const COURT_KEY = 'judge.courtEntries'
export const getCourtEntries = () => Number(read(COURT_KEY, 0)) || 0
export const countCourtEntry = () => write(COURT_KEY, getCourtEntries() + 1)
// 이 기기에서 법정까지 간 판 수 — 모드 고른 횟수와 끝낸 재판 수 중 큰 쪽 (기록 기능보다 먼저 한 판도 센다)
export function localPlays() {
  const done = Object.values(getProgress()).reduce((n, p) => n + (p?.plays || 0), 0)
  return Math.max(getCourtEntries(), done)
}

// ------------------------------------------------------------------ 만 14세 이상 확인 (2026-11-24 법 · 개인정보 검토)
//   새 저장 키를 만들지 않고 기존 설정 키(mg.settings — 처리방침 8장 '안내 표시들')에 age14 한 칸. 가입 · 손님 시작 모두 같은 값을 쓴다
export const ageConfirmed = () => getSettings().age14 === true
export const setAgeConfirmed = (v) => saveSettings({ ...getSettings(), age14: !!v })
