// 게임 API 호출 (개발: vite proxy, 배포: gateway 가 /api 를 game_backend 로 프록시 → 상대 경로만 사용)
//   재판 API 는 계정 토큰(Authorization: Bearer)으로 — auth.js 가 만료 전에 조용히 갱신한다
import { accessTokenNow, authHeaders, guestNow, withAuthRetry, withGameAuth } from './auth.js'
import { featureOn } from './features.js'
import { getPlayerId } from './player.js'
import { ageConfirmed } from './storage.js'

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function jsonOrThrow(res) {
  if (res.ok) return res.json()
  let code = 'http_error'
  let message = `${res.status} ${res.statusText}`
  try {
    const body = await res.json()
    if (typeof body.detail === 'string') message = body.detail
    else if (body.detail) ({ code = code, message = message } = body.detail)
  } catch {
    /* 본문 없음 */
  }
  if (res.status === 429 && code === 'http_error') message ='요청이 너무 많아요. 잠시 후 다시 시도해 주세요'
  // 본문 없는 서버 오류 (게이트웨이 · 프록시가 만든 502/503/504 등) — '502 Bad Gateway' 대신 알아듣게
  if (res.status >= 500 && code === 'http_error') {
    code = 'server_unavailable'
    message = '서버가 잠시 응답하지 않아요. 잠시 후 다시 시도해 주세요'
  }
  throw new ApiError(res.status, code, message)
}

// 연결 자체가 안 될 때 (오프라인 · 서버 다운) — 브라우저의 'Failed to fetch' 대신
function offline(e) {
  if (e?.name !== 'TypeError') throw e
  throw new ApiError(0, 'network',
    typeof navigator !== 'undefined' && navigator.onLine === false
      ? '인터넷 연결이 끊겼어요. 연결을 확인한 뒤 다시 시도해 주세요'
      : '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요')
}

const get = (url) => fetch(url).catch(offline).then(jsonOrThrow)
const post = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .catch(offline)
    .then(jsonOrThrow)
// 계정 토큰을 붙여서 (만료면 한 번 갱신 후 다시)
//   게임 서버 API 는 손님 플레이(features.js guestPlay)가 켜져 있으면 계정이 없을 때 손님 토큰으로 — 계정 API(인증 서비스)는 계정 토큰만
const ACCOUNT_API = /^\/api\/(me|ranks|hall|auth|avatars)(\/|\?|$)/
const withToken = (url, doFetch) => (ACCOUNT_API.test(url) ? withAuthRetry(doFetch) : withGameAuth(doFetch, featureOn('guestPlay')))
const authGet = (url) => withToken(url, (h) => fetch(url, { headers: h })).catch(offline).then(jsonOrThrow)
const authPost = (url, body) =>
  withToken(url, (h) =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(body) }),
  ).catch(offline).then(jsonOrThrow)

export const fetchHealth = () => get('/api/health')
export const fetchCases = () => authGet('/api/cases')   // 계정 토큰 — 미리 보기 계정이면 예약 사건도 열림
export const fetchCase = (id) => authGet(`/api/cases/${encodeURIComponent(id)}`)
// 사건 · 역할별 승소율 (관리자 · 점검 계정 제외) {caseId: {prosecution: {played, won}, defense: {…}}}
export const fetchCaseStats = () => get('/api/ranks/case-stats').then((d) => d.stats || {}).catch(() => ({}))
// 재판장 · 검사 · 변호인 반실사 캐릭터 이미지 {role: {mood: src}} — 비어 있으면 SVG 인물
export const fetchCast = () => get('/api/cast').then((d) => d.cast || {})

// replace: 같은 사건 · 역할로 진행(휴정) 중인 재판을 기권시키고 새로 시작 (아니면 서버가 409 trial_in_progress 로 묻는다)
// challenge: 받은 도전장 토큰 — 같은 사건 · 같은 역할일 때만 서버가 도전으로 기록 (판결 뒤 두 사람 결과 비교)
// 로그인 없이(손님) 처음 시작하려면 '만 14세 이상입니다' 확인이 먼저 (2026-11-24 법 검토) — 계정이 있거나 이미 손님이면 묻지 않는다
async function needAge14() {
  if (ageConfirmed() || guestNow()) return
  const h = await authHeaders().catch(() => ({}))
  if (h.Authorization) return
  const e = new Error('아래 ‘만 14세 이상입니다’를 먼저 눌러 주세요')
  e.code = 'age_required'
  throw e
}
export const createTrial = async ({ caseId, role, replace = false, challenge = null }) => {
  await needAge14()
  return authPost('/api/trials', { caseId, role, ...(replace ? { replace: true } : {}), ...(challenge ? { challenge } : {}) })
}
// 같은 사건 도전장 — 판결 난 내 재판으로 만들기 (같은 재판은 같은 토큰) · 받은 도전장 요약 보기
export const createChallenge = (trialId) => authPost(`/api/trials/${encodeURIComponent(trialId)}/challenge`, {})
export const fetchChallenge = (token) => get(`/api/challenges/${encodeURIComponent(token)}`)
// 오늘 남은 AI 재판 (하루 횟수 — 서버 core/ai_quota.py) {used, limit, left, resetAt, unlimited, budget}
// 사건 목록을 열기만 한 방문자에게 이 조회 하나 때문에 손님 계정을 새로 만들지 않는다 —
//   계정도 손님 토큰도 없으면 손님 기본값(서버 AI_DAILY_TRIALS_GUEST=3)을 그대로 보인다. 재판을 시작하면 그때 손님 토큰이 생기고 서버 값을 읽는다
export const GUEST_AI_TRIALS = 3
export async function fetchAiQuota() {
  const h = await authHeaders().catch(() => ({}))
  if (!h.Authorization && !guestNow()) return { used: 0, limit: GUEST_AI_TRIALS, left: GUEST_AI_TRIALS, resetAt: null }
  return authGet('/api/v1/ai-quota')
}
// 내가 보낸 도전장 — 받은 사람 수(도전 · 완료 · 나를 이긴 사람)만
export const fetchMyChallenges = () => authGet('/api/challenges/mine').then((d) => d.challenges || [])
// 진행(휴정) 중인 내 재판 — 사건 목록의 '이어 하기' (계정 기준이라 다른 기기에서도) {trials: [...], max}
export const fetchActiveTrials = () => authGet('/api/trials/active')
// 휴정하고 나가기 — 재판은 그대로 남고 시계가 멈춘다 (다시 열면 속개)
export const recessTrial = (trialId) => authPost(`/api/trials/${encodeURIComponent(trialId)}/recess`, {})
// 탭을 닫거나 화면이 숨을 때 — 응답을 기다리지 않는 휴정 (페이지가 닫혀도 요청은 간다 · 토큰이 만료됐으면 보내지 않음:
//   그래도 서버 활동 시계는 요청 사이 공백을 5분까지만 세므로 오래 비워도 기권되지 않는다)
export function recessOnLeave(trialId) {
  const token = accessTokenNow() || (featureOn('guestPlay') ? guestNow()?.token : null)
  if (!token || !trialId) return
  try {
    fetch(`/api/trials/${encodeURIComponent(trialId)}/recess`, {
      method: 'POST', keepalive: true, body: '{}',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    }).catch(() => {})
  } catch { /* keepalive 를 못 쓰는 브라우저 */ }
}

export const fetchTrial = (trialId) => authGet(`/api/trials/${encodeURIComponent(trialId)}`)

// evidenceId: 함께 제시할 증거 (선택) — 질문 없이 증거만 들이밀어도 된다
export const interrogate = (trialId, witnessId, question, evidenceId = null) =>
  authPost(`/api/trials/${encodeURIComponent(trialId)}/interrogate`, {
    witnessId,
    question,
    ...(evidenceId ? { evidenceId } : {}),
  })

// 이의 있음! — 방금 끝난 라운드의 상대측 반론에 증거를 들이민다 (라운드당 한 번, 코드 판정) → {…view, counter}
export const raiseObjection = (trialId, round, evidenceId, ground = 'contradiction') =>
  authPost(`/api/trials/${encodeURIComponent(trialId)}/objection`, { round, ground, ...(evidenceId ? { evidenceId } : {}) })

// 증인석 증언 — 증언 받기 · 문장에 추궁(press) · 증거 제시(present) · 대질(confront)
export const testify = (trialId, witnessId) => authPost(`/api/trials/${encodeURIComponent(trialId)}/testify`, { witnessId })
export const testimonyAction = (trialId, body) => authPost(`/api/trials/${encodeURIComponent(trialId)}/testimony`, body)
// 상대측 이의가 인정됐을 때 증거로 맞받아치기 → {…view, reply}
export const replyObjection = (trialId, round, evidenceId) =>
  authPost(`/api/trials/${encodeURIComponent(trialId)}/objection-reply`, { round, evidenceId })

// 명변론 전당 — 올리기(게임 서버가 점수 · 소유 확인) · 목록 · 추천 · 내리기 (인증 서비스)
export const submitHall = (trialId, round) => authPost(`/api/trials/${encodeURIComponent(trialId)}/hall`, { round })
//   mine: 내가 올린 글만 (로그인 필요 · 숨겨진 것 포함) — 전당을 꺼 둔 동안 '나의 기록'에서 지우는 길 (처리방침 6장)
export const fetchHall = ({ caseId = null, sort = 'top', limit = 30, mine = false } = {}) =>
  authGet(`/api/hall?sort=${sort}&limit=${limit}${caseId ? `&case=${encodeURIComponent(caseId)}` : ''}${mine ? '&mine=true' : ''}`).then((d) => d.entries || [])
export const likeHall = (id) => authPost(`/api/hall/${id}/like`, {})
export const removeHall = (id) => authPost(`/api/hall/${id}/remove`, {})

// 시즌 순위 (한국 시간 한 달) — season 없으면 이번 시즌 + 지난 시즌 1~3위
export const fetchSeason = (season = null) => get(`/api/ranks/season${season ? `?season=${season}` : ''}`)

// 조사 단계 — action: visit | search | extra | acquire | ask | finish
export const investigate = (trialId, action, body = {}) =>
  authPost(`/api/trials/${encodeURIComponent(trialId)}/investigate`, { action, ...body })

// 최후 변론 전 전략 (도덕적 딜레마)
export const chooseDilemma = (trialId, choiceId) => authPost(`/api/trials/${encodeURIComponent(trialId)}/dilemma`, { choiceId })

// choiceId: 입문 재판 — 고른 보기 (text 는 덧붙이는 한 줄, 비워도 됨)
// nudged: 재판장이 "제 질문에 답이 없군요" 되물은 뒤 낸 변론 — fixed(보완) · kept(그대로) (지표용)
export const streamArgument = (trialId, text, opts, choiceId = null) =>
  streamSse(`/api/trials/${encodeURIComponent(trialId)}/arguments`,
    {
      text,
      ...((opts?.choiceId ?? choiceId) ? { choiceId: opts?.choiceId ?? choiceId } : {}),
      ...(opts?.nudged ? { nudged: opts.nudged } : {}),
    }, opts)

// 재판 모드 — 법정 출두 전에 (easy 입문 · standard 자유 변론 · legal 실무)
export const chooseMode = (trialId, mode) => authPost(`/api/trials/${encodeURIComponent(trialId)}/mode`, { mode })

export const streamVerdict = (trialId, opts) => streamSse(`/api/trials/${encodeURIComponent(trialId)}/verdict`, {}, opts)

export const STREAM_CUT_MESSAGE = '응답을 받는 중에 연결이 끊겼어요. 잠시 후 다시 시도해 주세요'

/**
 * SSE 스트림 (POST). EventSource 는 GET 만 지원하므로 fetch + ReadableStream 으로 직접 파싱.
 * onEvent(eventName, data) 가 이벤트마다 호출된다.
 * 받는 도중 끊기면 ApiError(code 'stream_cut') — 부르는 쪽(Courtroom 의 변론 · 판결)이 재판을 다시 읽어 맞춘다
 */
async function streamSse(url, body, { onEvent, signal } = {}) {
  const res = await withToken(url, (h) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...h },
      body: JSON.stringify(body),
      signal,
    }),
  ).catch(offline)
  if (!res.ok || !res.body) await jsonOrThrow(res)

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    let step
    try {
      step = await reader.read()
    } catch (e) {
      // 받는 도중 끊김(망 끊김 · 서버 재시작) — 브라우저의 'network error' · 'Load failed' 같은 영어 대신 (2026-11-25 전체 시험)
      if (e?.name === 'AbortError') throw e
      throw new ApiError(0, 'stream_cut', STREAM_CUT_MESSAGE)
    }
    const { value, done } = step
    if (done) break
    buffer += value.replace(/\r\n/g, '\n')
    let sep
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      const parsed = parseSseBlock(block)
      if (parsed) onEvent?.(parsed.event, parsed.data)
    }
  }
}

function parseSseBlock(block) {
  let event = 'message'
  const dataLines = []
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
  }
  if (!dataLines.length) return null
  try {
    return { event, data: JSON.parse(dataLines.join('\n')) }
  } catch {
    return { event, data: dataLines.join('\n') }
  }
}

// 화면 조회 기록 (방문자 · 페이지뷰 지표) — 실패해도 게임에는 영향 없음. 처음 한 번만 외부 유입 경로를 함께 보낸다
let refSent = false
// 링크 전환 (초대 · 도전장 링크 → 가입 → 첫 재판 → 첫 판결) — 서버가 방문자 · 단계마다 한 번만 센다 (invite.js markFunnel)
export function sendFunnel(kind, step) {
  const token = accessTokenNow()
  fetch('/api/funnel', {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ visitorId: getPlayerId(), kind, step }),
  }).catch(() => {})
}

export function recordVisit(screen) {
  let ref
  if (!refSent) {
    refSent = true
    try {
      const r = document.referrer && new URL(document.referrer)
      if (r && r.host !== window.location.host) ref = r.host + r.pathname
    } catch {
      /* 잘못된 referrer */
    }
  }
  fetch('/api/visit', {
    method: 'POST',
    keepalive: true,
    // 로그인돼 있으면 토큰도 — 서버가 운영자 계정의 방문을 지표에서 뺀다 (기기마다 방문자 ID 를 따로 적지 않아도)
    headers: { 'Content-Type': 'application/json', ...(accessTokenNow() ? { Authorization: `Bearer ${accessTokenNow()}` } : {}) },
    body: JSON.stringify({ visitorId: getPlayerId(), screen, ref }),
  }).catch(() => {})
}

// 재판 포기 → 패소 처리, 다시 열 수 없음 (잠깐 나가는 것은 recessTrial)
export const forfeitTrial = (trialId) => authPost(`/api/trials/${encodeURIComponent(trialId)}/forfeit`, {})
// 나의 기록에서 사건의 진실 보기 — 서버가 '진실 열람'을 남긴 뒤 돌려준다 (이후 이 사건 랭크 없음)
export const revealTruth = (caseId) => authPost(`/api/cases/${encodeURIComponent(caseId)}/truth`, {})
// 끝난 재판(판결 · 포기 · 시간 초과)의 결과 화면에서 사건의 진실 보기 — 같은 규칙 (로그인 계정은 이후 이 사건 랭크 없음)
export const revealTrialTruth = (trialId) => authPost(`/api/trials/${encodeURIComponent(trialId)}/truth`, {})

// ------------------------------------------------------------------ 법정 아바타 — 만들기 · 친구 · 플레이어 프로필은 화면에서 내렸다 (서버 주소 · 데이터는 그대로). 예전에 만든 아바타 지우기만 남김
const authDelete = (url) => withAuthRetry((h) => fetch(url, { method: 'DELETE', headers: h })).then(jsonOrThrow)

export const fetchMyAvatar = () => authGet('/api/me/avatar')
export const deleteAvatar = () => authDelete('/api/me/avatar')

// 지금 접속 중인 사람 수 — 1분마다 알리고 받은 수를 화면에 알린다 (mg:online 이벤트)
//   방문자 ID 만 보낸다. '내 활동 보이기'(지금 하는 사건 · 단계 보내기)는 2026-11-24 종료 — 예전 설정(mg.settings 의 shareActivity)이
//   켜져 있어도 보내지 않는다 (사용자 확정 · 처리방침 2026-12-26 판에서 삭제)
let lastOnline = null
export const onlineNow = () => lastOnline
export function pingOnline() {
  const body = { visitorId: getPlayerId() }
  return withAuthRetry((h) => fetch('/api/online', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...h },
    body: JSON.stringify(body),
  }))
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d && typeof d.online === 'number') {
        lastOnline = Math.max(1, d.online)          // 나 자신은 늘 접속 중
        window.dispatchEvent(new CustomEvent('mg:online', { detail: lastOnline }))
      }
    })
    .catch(() => {})
}
