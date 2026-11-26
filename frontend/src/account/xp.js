// 허브 통합 점수(EXP) — 모든 게임이 같은 점수를 쌓는다 (플랫폼 v2 단계 C · E · 문서 reports/api_v1.md)
//   게임은 '무슨 일이 있었는지'만 알린다 — awardXp('future', 'game_clear', 'future:clear:CASE_001:<판 id>')
//   몇 점인지는 서버가 정한다(이유표 auth_service/app/xp.py). 같은 key 는 한 번만 · 이유마다 하루 상한 → 화면이 여러 번 불러도 안전
//   이유: game_clear(클리어 10) · first_play(새 게임 첫 플레이 5) · daily_mission(허브 일일 미션 30) · invite_success(서버만)
//   로그인 없이 한 일(단계 E): 기기 대기열(hub.xp.queue)에 모아 두었다가 로그인 · 가입 · 복구하는 순간 같은 key 로 보낸다
//     → 서버의 중복 방지 키 · 하루 상한이 그대로 적용 (두 번 받지 않음, 보내는 날의 상한 안에서만)
//   이 파일은 react 를 쓰지 않는다 (node --test 로 바로 시험) — 허브와 모든 게임이 가져다 써도 된다
import { authHeaders, currentUser, onSession, withAuthRetry } from '../auth.js'
import { gameEvent } from '../analytics.js'

const cleared = new Set()            // 이 탭에서 이미 클리어 지표를 보낸 판 키
export const XP_KEY = /^[A-Za-z0-9._:@-]{8,120}$/
export const XP_EVENT = 'hub:xp'      // 점수를 받으면 window 에 알린다 (허브 · 게임 화면이 '+10 EXP' 를 띄울 수 있게)
export const XP_QUEUE = 'hub.xp.queue'
export const QUEUE_MAX = 30                      // 손님 대기열 최대 (넘으면 오래된 것부터 버림 — 어차피 하루 상한이 있다)
export const QUEUE_TTL_MS = 14 * 24 * 3600 * 1000  // 2주 지난 손님 기록은 보내지 않는다

const GAME = /^[a-z][a-z0-9]{1,15}$/
const REASON = /^[a-z][a-z0-9_]{1,31}$/

function readQueue() {
  try {
    const v = JSON.parse(localStorage.getItem(XP_QUEUE) || '[]')
    return Array.isArray(v) ? v.filter((e) => e && typeof e.key === 'string') : []
  } catch { return [] }
}
function writeQueue(q) {
  try {
    if (q.length) localStorage.setItem(XP_QUEUE, JSON.stringify(q))
    else localStorage.removeItem(XP_QUEUE)
  } catch { /* 저장 불가(사생활 보호 모드) — 손님 점수는 이 기기에 남지 않는다 */ }
}
export const queuedXp = () => readQueue()

function enqueue(game, reason, key) {
  const q = readQueue()
  if (q.some((e) => e.key === key)) return { queued: true, duplicate: true }   // 같은 일 — 한 번만
  q.push({ game, reason, key, at: Date.now() })
  writeQueue(q.slice(-QUEUE_MAX))
  return { queued: true }
}

function notify(detail) {
  try { window.dispatchEvent(new CustomEvent(XP_EVENT, { detail })) } catch { /* 창 없음(테스트) */ }
}

// 서버로 한 건 → { status, data } (네트워크 오류면 status 0)
async function post(game, reason, key) {
  try {
    const res = await withAuthRetry((h) => fetch('/api/v1/me/xp', {
      method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ game, reason, key }),
    }))
    return { status: res.status, data: await res.json().catch(() => ({})) }
  } catch {
    return { status: 0, data: {} }
  }
}
// 다시 보내도 결과가 같은 거절(형식 · 모르는 이유 · 서버만 · 키 충돌) — 대기열에서 버린다. 401 · 429 · 5xx · 네트워크는 남겨 두고 다음에
const permanent = (s) => s >= 400 && s < 500 && ![401, 408, 429].includes(s)

// 점수 받기 — 절대 throw 하지 않는다(게임 진행을 막지 않게). 돌려주는 값:
//   { queued: true }           로그인 안 함 — 기기 대기열에 모아 둠 (로그인하면 보냄)
//   { skipped: 'bad_key' }     key · 게임 · 이유 형식이 틀림 (key 8~120자, 영문 · 숫자 · . _ : @ -)
//   { error: code }            서버가 거절 · 네트워크 오류
//   서버 응답 { awarded, duplicate, capped, total, level, entry }
export async function awardXp(game, reason, key) {
  if (typeof key !== 'string' || !XP_KEY.test(key) || !GAME.test(String(game)) || !REASON.test(String(reason))) return { skipped: 'bad_key' }
  if (reason === 'game_clear' && !cleared.has(key)) { cleared.add(key); gameEvent(game, 'clear') }   // 게임별 완주율 지표 (로그인과 상관없이, 같은 판은 한 번)
  if (!currentUser()) return enqueue(game, reason, key)
  const { status, data } = await post(game, reason, key)
  if (status === 0) return { error: 'network' }
  if (status >= 400) return { error: data?.detail?.code || `http_${status}` }
  if (data.awarded > 0) notify(data)
  return data
}

// 손님 대기열을 지금 로그인한 계정으로 보낸다 — 로그인 · 가입 · 복구 순간 자동 (아래 onSession). 동시에 두 번 돌지 않는다
//   → { sent, awarded, left }
let flushing = null
export function flushXpQueue() {
  if (flushing) return flushing
  if (!currentUser() || !readQueue().length) return Promise.resolve({ sent: 0, awarded: 0, left: readQueue().length })
  flushing = (async () => {
    let sent = 0
    let awarded = 0
    const now = Date.now()
    for (const e of readQueue()) {
      if (!currentUser()) break                                    // 도중에 로그아웃
      let drop = !(now - (e.at || 0) < QUEUE_TTL_MS)               // 너무 오래된 것은 보내지 않고 버림
      if (!drop) {
        const { status, data } = await post(e.game, e.reason, e.key)
        if (status >= 200 && status < 300) { drop = true; sent += 1; awarded += data.awarded || 0 }
        else if (permanent(status)) drop = true
        else break                                                 // 네트워크 · 서버 · 로그인 문제 — 남은 것은 다음 기회에
      }
      if (drop) writeQueue(readQueue().filter((x) => x.key !== e.key))   // 도는 사이 새로 쌓인 것은 지키며 하나씩 뺀다
    }
    if (awarded > 0) notify({ awarded, merged: sent })
    return { sent, awarded, left: readQueue().length }
  })().finally(() => { flushing = null })
  return flushing
}

// 로그인 · 가입 · 복구 · 토큰 갱신 때마다 — 대기열이 비어 있으면 아무것도 안 한다
onSession((s) => { if (s?.user) flushXpQueue() })
if (currentUser()) flushXpQueue()

// 내 EXP (누적 · 레벨 · 이번 주 · 게임별 · 최근 기록) — 로그인 안 했으면 null
export async function fetchMyXp(recent = 20) {
  if (!currentUser()) return null
  const res = await withAuthRetry((h) => fetch(`/api/v1/me/xp?recent=${recent}`, { headers: h }))
  if (!res.ok) throw new Error('내 EXP 를 불러오지 못했어요')
  return res.json()
}

// 주간 EXP 순위 (닉네임만) — 로그인했으면 내 등수(me)도
export async function fetchWeeklyRanks(limit = 20) {
  const h = currentUser() ? await authHeaders() : {}
  const res = await fetch(`/api/v1/ranks/weekly?limit=${limit}`, { headers: h })
  if (!res.ok) throw new Error('주간 순위를 불러오지 못했어요')
  return res.json()
}

// ------------------------------------------------------------------ 오늘의 미션 (허브 홈 카드 — 이유 daily_mission 30 EXP, 하루 1)
//   조건: 오늘(한국 시간) 아무 게임 1판 클리어. 받을 수 있는지는 서버가 원장으로 확인한다(화면의 주장만으로는 409 mission_incomplete)
//   손님: 기기 대기열로 진행을 보고, 받기도 대기열에 (로그인하면 클리어 → 미션 순서로 보내져 서버 확인을 통과한다)
export const kstDate = (t = Date.now()) => new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10)
export const missionKey = (t) => `mission:${kstDate(t)}`
export const MISSION = { reason: 'daily_mission', amount: 30, goal: 1 }
export function guestMission(now = Date.now()) {
  const today = kstDate(now)
  const q = readQueue()
  return {
    ...MISSION,
    progress: q.some((e) => e.reason === 'game_clear' && kstDate(e.at || 0) === today) ? 1 : 0,
    claimed: q.some((e) => e.key === missionKey(now)),
  }
}
export const claimMission = () => awardXp('hub', 'daily_mission', missionKey())
