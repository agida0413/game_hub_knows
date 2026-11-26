// 화면 오류 수 — 게임별 '오류' 지표 (어드민 허브 현황판 · Grafana '게임 화면 오류 급증' 알림, 2026-11-25)
//   오류 내용 · 주소 · 기기 정보는 보내지 않는다 — 그 화면이 어느 게임인지와 '한 번 났다'만 (gameEvent(게임, 'error'))
//   한 화면(페이지를 한 번 열 때)마다 게임당 3번까지. 우리 코드 탓이 아닌 것은 세지 않는다:
//     다른 출처 스크립트('Script error.') · ResizeObserver 경고 · 브라우저 확장 프로그램 · 망 끊김(Failed to fetch · Load failed · AbortError)
//   react · 브라우저 객체 없이 시험할 수 있게 보내는 길(send) · 첫 화면 판단(root)은 main.jsx 가 넣는다
import { appHash } from './routes.js'

const OWN = {
  archive: 'judge', case: 'judge', trial: 'judge', records: 'judge', m: 'judge',
  future: 'future', search: 'search', room: 'room', knows: 'knows', train: 'train', beat: 'beat',
}
const V2 = new Set(['beat', 'rules', 'edge', 'tim', 'knows', 'train'])
export const MAX_PER_GAME = 3

// 주소(#/이름/…) → 게임. 첫 화면('')은 기기에 따라 허브 또는 최후의 변론(root) · 허브 · 계정 · 약관 · 준비 중 자리는 'hub'
export function errorGame(hash, root = null) {
  const parts = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean)
  const name = parts[0] || 'title'
  if (OWN[name]) return OWN[name]
  if (name === 'v2') return V2.has(parts[1]) ? parts[1] : null
  if (name === 'title') return root || 'hub'
  return 'hub'
}

const NOISE = /^(Script error\.?|ResizeObserver loop.*)$|^(Failed to fetch|Load failed|NetworkError.*|The operation was aborted\.?|.*AbortError.*)$/i
export function ignorable(message, source = '') {
  const m = String(message || '').trim()
  if (!m || NOISE.test(m)) return true
  return /^(chrome|moz|safari(-web)?)-extension:/i.test(String(source || ''))
}

// 게임마다 max 번까지만 send(game) — 같은 화면에서 오류가 되풀이돼도 지표가 부풀지 않게
export function makeCounter(send, max = MAX_PER_GAME) {
  const seen = new Map()
  return (game) => {
    if (!game) return false
    const n = seen.get(game) || 0
    if (n >= max) return false
    seen.set(game, n + 1)
    try { send(game) } catch { /* 지표 실패는 무시 */ }
    return true
  }
}

let current = null
// 화면 그리기 오류(ErrorBoundary) — 설치 전이면 아무것도 안 함
export function countError() {
  return current ? current() : false
}

export function installErrorCount(win, send, root = () => null) {
  if (!win || typeof win.addEventListener !== 'function') return
  const count = makeCounter(send)
  const here = () => { try { return errorGame(appHash(win.location), root()) } catch { return 'hub' } }   // /g/<게임> 주소도 그 게임으로
  current = () => count(here())
  win.addEventListener('error', (e) => { if (!ignorable(e && e.message, e && e.filename)) count(here()) })
  win.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason
    const msg = r && typeof r === 'object' ? `${r.name === 'AbortError' ? 'AbortError' : ''}${r.message || ''}` : String(r || '')
    if (!ignorable(msg || 'unknown')) count(here())
  })
}
