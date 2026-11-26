// 막간 공용 약속 (2026-11-26 허브 유지 + 게임 독립 2단계) — 게임 코드는 허브 · 다른 게임 · 앱 전역 대신 이 폴더만 부른다
//   게임을 떼어 내 다른 도메인 · 서버로 옮길 때는 이 폴더의 같은 이름 함수만 새로 만들어 주면 게임 코드는 그대로 돈다
//   react 없음 (node --test 로 바로 시험) — 화면 조각(머리줄 · 다른 게임 · 안내 훅)은 ./react.js
//
//   계정   me() · onLogin(fn) · login()            지금 로그인한 사람 · 바뀔 때 알림 · 로그인 화면으로(끝나면 이 게임으로 돌아옴)
//   운영자 isOperator()                            운영자 계정인가 (지표에서 빠지는 처리는 서버가 그대로)
//   기록   store(game)                             기기 저장소 — 키는 '<게임>.이름' 으로만 (./keys.js 가 옛 키를 옮겨 붙임)
//   EXP    exp.add(game, reason, key)              허브 통합 점수 — 몇 점인지는 서버가 정한다(이유표). 게임 화면에는 띄우지 않는다
//   지표   track(game, event, { step, label })    게임별 지표 — 이름 · 단계만, 개인정보 없음
//   공유   shareUrl(game, go) · share(game, text)  /g/<게임>?src=share 링크 · 공유창(안 되면 복사)
//   상태   gameStatus(game)                        서비스 live · 점검 maint · 준비 soon (어드민이 덮은 값 포함)
import { currentUser, ensureSession, onSession } from '../auth.js'
import { awardXp } from '../account/xp.js'
import { gameEvent } from '../analytics.js'
import { GAMES, isOperator as isOperatorUser0 } from '../hub/games.js'
import { shareLink } from '../src.js'
import { appHash } from '../routes.js'
import { shareOrCopy } from './shareOrCopy.js'

const GAME = /^[a-z][a-z0-9]{1,15}$/

// ------------------------------------------------------------------ 계정
export const me = () => currentUser()
export const ready = () => ensureSession().then((s) => s?.user || null).catch(() => null)
export const onLogin = (fn) => onSession((s) => fn(s?.user || null))
export function login() {
  try { sessionStorage.setItem('hub.after', appHash(window.location) || '#/hub') } catch { /* 돌아올 곳 저장 불가 — 허브로 */ }
  window.location.href = '/#/account'
}
export const isOperator = () => isOperatorUser0(currentUser())

// ------------------------------------------------------------------ 기기 저장소 (게임 id 로 묶음)
function local() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}
// store('room').get('v3') → localStorage 'room.v3'. 저장이 안 되는 브라우저(사생활 모드)에서도 멈추지 않는다
export function store(game, storage = local()) {
  if (!GAME.test(game)) throw new Error(`게임 id 형식이 아님: ${game}`)
  const key = (name) => `${game}.${name}`
  return {
    key,
    get(name, fallback = null) {
      try { const v = storage?.getItem(key(name)); return v == null ? fallback : v } catch { return fallback }
    },
    set(name, value) {
      try { storage?.setItem(key(name), String(value)); return true } catch { return false }
    },
    getJson(name, fallback = null) {
      try { const v = storage?.getItem(key(name)); return v == null ? fallback : JSON.parse(v) } catch { return fallback }
    },
    setJson(name, value) {
      try { storage?.setItem(key(name), JSON.stringify(value)); return true } catch { return false }
    },
    remove(name) {
      try { storage?.removeItem(key(name)) } catch { /* 지울 수 없음 */ }
    },
  }
}

// ------------------------------------------------------------------ EXP · 지표 · 공유
export const exp = {
  // 무슨 일이 있었는지만 알린다 — 같은 key 는 한 번만, 손님이면 기기에 모았다가 로그인할 때 보낸다 (account/xp.js)
  add(game, reason, key) {
    try { return Promise.resolve(awardXp(game, reason, key)).catch(() => null) } catch { return Promise.resolve(null) }
  },
}
export function track(game, event, { step, label } = {}) {
  try { gameEvent(game, event, step, label) } catch { /* 지표 실패는 무시 */ }
}
// 공유 링크 — /g/<게임>?src=share[&go=도전 주소 조각]. 서버 · 화면이 미리보기와 게임을 연다
export const shareUrl = (game, go = '') => shareLink(game, go)
// 공유창(안 되면 복사) → 'shared' · 'copied' · 'cancel' · 'fail'. 지표 'share' 도 함께 센다
export async function share(game, text, { count = true } = {}) {
  if (count) track(game, 'share')
  return shareOrCopy(text)
}
export { shareOrCopy }

// ------------------------------------------------------------------ 상태
export const gameStatus = (game) => GAMES.find((g) => g.id === game)?.status || 'soon'
// 이 사람이 운영자인가 (useAccount 로 받은 사람) — 화면이 사람을 이미 들고 있을 때
export const isOperatorUser = (user) => isOperatorUser0(user)
