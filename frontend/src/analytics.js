// 게임별 지표 → 서버 POST /api/v1/events (플랫폼 개편 H — DAU · MAU · 이탈 · 완주율 · 튜토리얼 단계별 이탈)
//   기기 무작위 ID 만 보낸다(개인정보 없음). 로그인해 있으면 토큰도 — 서버가 운영자 기록을 뺀다
//   실패해도 게임에 영향 없음. 같은 화면 열기는 탭 하나에서 게임마다 한 번만
//   game: judge · future · search · room · knows · hub · beat · rules · edge · tim (시제품) · train(내릴게요)
//   event: open · start · clear · tour_start · tour_step · tour_done · tour_skip
//          · 최후의 변론 개편: next_start · lock_row · lock_spot · court_side(step = 출두 때 내 편 증거 수)
import { accessTokenNow } from './auth.js'
import { getPlayerId } from './player.js'
import { currentSrc, takeSrcLabel } from './src.js'

const GAMES = new Set(['judge', 'future', 'search', 'room', 'knows', 'hub', 'beat', 'rules', 'edge', 'tim', 'train'])   // beat · rules · edge · tim = 시제품 (도마 박자 · 가짜 수칙 · 끄트머리 · 틈) · train = 내릴게요
const EVENTS = new Set(['open', 'start', 'clear', 'tour_start', 'tour_step', 'tour_done', 'tour_skip', 'ab',
  'next_start', 'lock_row', 'lock_spot', 'court_side', 'share',   // share = 공유 버튼 누름 (유입 개선) · 최후의 변론 개편 — 다음 사건 시작 · 잠긴 줄 누름 · 자물쇠 누름 · 출두 때 내 편 증거 수(step)
  'error'])   // 화면 오류 — 횟수만 (errorCount.js, 2026-11-25 어드민 허브 현황판)
const opened = new Set()

const AB_LABEL = /^ab[0-9]{1,2}_[a-z0-9]{1,12}_[a-z0-9]{1,12}$/
export const isAbLabel = (s) => AB_LABEL.test(String(s || ''))

function post(game, event, step, label) {
  try {
    const token = accessTokenNow()
    fetch('/api/v1/events', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ visitorId: getPlayerId(), game, event, ...(Number.isInteger(step) ? { step } : {}), ...(event === 'ab' ? { label } : {}), ...(event === 'start' && currentSrc() ? { src: currentSrc() } : {}) }),
    }).catch(() => {})
  } catch { /* 지표 실패는 무시 */ }
}

// label: event 가 'ab' 일 때 — A/B 이해 지표 이름(예: ab1_hint_esc0). 이름 · 단계만, 개인정보 없음
export function gameEvent(game, event, step, label) {
  if (!GAMES.has(game) || !EVENTS.has(event)) return
  if (event === 'ab' && !isAbLabel(label)) return
  if (event === 'open') {
    if (opened.has(game)) return
    opened.add(game)
  }
  post(game, event, step, label)
  if (event === 'clear') { try { window.dispatchEvent(new CustomEvent('mg:clear', { detail: { game } })) } catch { /* 신호 실패는 무시 */ } }   // 홈 화면에 추가 권유(platform/InstallHint)가 듣는다
  // 유입 채널 — 이 기기가 ?src= 로 처음 왔다면 그 게임을 처음 연 것 · 첫 판을 한 것을 채널 이름으로 한 번씩 센다 (src.js)
  if (event === 'open' || event === 'start') {
    const l = takeSrcLabel(game, event)
    if (l) post(game, 'ab', undefined, l)
  }
}

// 공통 튜토리얼 기록(onboarding track) 을 서버 이벤트 이름으로
export const TOUR_EVENT = { start: 'tour_start', step: 'tour_step', done: 'tour_done', skip: 'tour_skip' }
