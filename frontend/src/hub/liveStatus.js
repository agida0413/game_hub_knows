// 서버가 정한 게임 상태로 games.js 의 status 를 덮는다 (2026-11-25 사용자 지시 — 어드민에서 배포 없이 서비스 · 점검 중 · 준비 중 전환)
//   서버 /api/maintenance 의 games = {게임 id: 'live' | 'maint' | 'soon'} — 어드민이 바꾼 게임만 들어 있다
//   읽는 곳: 점검 문지기(MaintenanceGate — 열 때 · 1분마다). 안전한 쪽으로:
//     · 서버가 없거나 오류 · games 칸이 없다 → 지금 값 그대로 (처음엔 games.js)
//     · 서버에 없는 게임 → games.js 에 적힌 값으로 돌아간다 · 모르는 게임 · 모르는 값 → 버린다
//   배열 순서(노출 순서)는 바꾸지 않는다 — 도마 박자는 서비스로 올리면 맨 앞 · 추천 자리 그대로
//   react 없음 (node --test). 화면 다시 그리기는 useLiveStatus.js
import { GAMES } from './games.js'

export const STATUSES = ['live', 'maint', 'soon']
const CODE = new Map(GAMES.map((g) => [g.id, g.status]))   // games.js 에 적힌 원래 값
let version = 0
const subs = new Set()

// 서버 값 → {id: status} (아는 게임 · 아는 값만)
export function cleanStatus(raw, games = GAMES) {
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const g of games) {
    const v = raw[g.id]
    if (STATUSES.includes(v)) out[g.id] = v
  }
  return out
}

// 서버 값을 적용 — 바뀐 게 있으면 true. raw 가 undefined · null(서버가 답을 못 줌 · 옛 서버)이면 아무것도 안 바꾼다
export function applyStatus(raw, games = GAMES, code = CODE) {
  if (raw === undefined || raw === null) return false
  const want = cleanStatus(raw, games)
  let changed = false
  for (const g of games) {
    const next = want[g.id] || code.get(g.id) || g.status
    if (g.status !== next) { g.status = next; changed = true }
  }
  if (changed) {
    version += 1
    for (const fn of subs) { try { fn() } catch { /* 한 구독자가 실패해도 나머지 */ } }
  }
  return changed
}

export const statusVersion = () => version
export function onStatus(fn) {
  subs.add(fn)
  return () => { subs.delete(fn) }
}
// games.js 에 적힌 값 (어드민 '코드대로' 와 같은 뜻)
export const codeStatus = (id) => CODE.get(id)
