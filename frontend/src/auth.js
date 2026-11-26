// 플레이어 계정 (인증 · 랭크 서비스 /api/auth · /api/me)
//
//   처음 온 사람: 닉네임 → 계정(UUID) + 복구 코드 (한 번만 보여 줌 — 저장하게 한다)
//   세션: 접근 토큰(12시간) + 갱신 토큰. 갱신 토큰은 localStorage 와 httpOnly 쿠키 두 곳에 있다
//     → localStorage 만 지워져도 쿠키로 조용히 이어지고, 둘 다 지워져도 복구 코드로 같은 계정을 되찾는다
//   어디서든 쓰는 함수: ensureSession() · authHeaders() · withAuthRetry()

import { PREVIEW_HEADER, previewOn } from './operator.js'
import { claimDevice, leaveDevice } from './account/owner.js'
import { ageConfirmed } from './storage.js'

const KEY = 'mg.session'
let session = load()
let noSessionUntil = 0   // 방금 갱신이 401(로그인 없음)이었다 — 그 뒤 잠깐은 다시 묻지 않는다 (처음 온 사람의 API 호출마다 갱신 401 이 먼저 나가던 것 · 2026-11-25 통합 시험)
// 이 기기 기록의 주인 — 다른 계정으로 들어오면 앞 계정의 기기 기록을 새 계정에 섞지 않는다 (account/owner.js)
claimDevice(session?.user?.id)
let refreshing = null
const listeners = new Set()

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null')
  } catch {
    return null
  }
}
function save(s) {
  session = s
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch {
    /* 저장 불가(사생활 보호 모드) — 쿠키 · 이 탭의 메모리로만 */
  }
  listeners.forEach((fn) => fn(s))
}

export const currentUser = () => session?.user || null
// 지금 살아 있는 접근 토큰 (기다리지 않고) — 탭을 닫을 때 보내는 요청용. 만료됐으면 null
export const accessTokenNow = () => (session?.accessToken && session.expiresAt > Date.now() ? session.accessToken : null)
export const onSession = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

async function call(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const d = data.detail || {}
    const err = new Error(d.message || (res.status === 429 ? '잠시 후 다시 시도해 주세요' : `오류 ${res.status}`))
    err.code = d.code
    err.status = res.status
    throw err
  }
  return data
}

// fresh: 가입 · 복구로 방금 들어왔다 (갱신은 같은 로그인이 이어지는 것)
function keep(data, { fresh = false } = {}) {
  noSessionUntil = 0
  claimDevice(data.user?.id, { fresh })   // 화면이 기기 기록을 읽기 전에 (save 가 화면에 알리기 전)
  save({
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + (data.expiresIn - 60) * 1000,
  })
  return data
}

// 접근 토큰이 살아 있으면 그대로, 아니면 갱신 토큰(저장소 → 쿠키)으로. 둘 다 없으면 null (처음 온 사람)
export async function ensureSession() {
  if (session?.accessToken && session.expiresAt > Date.now()) return session
  if (!refreshing) {
    if (!session && Date.now() < noSessionUntil) return null
    // 갱신 토큰은 쓸 때마다 바뀐다(회전) — 다른 탭이 이미 바꿨을 수 있어 저장소의 최신 것을 쓰고,
    // 거절되면(옛 토큰) 쿠키의 최신 토큰으로 한 번 더
    const latest = load()?.refreshToken || session?.refreshToken
    refreshing = call('/api/auth/refresh', { refreshToken: latest || undefined })
      .catch((e) => {
        if (e.status === 401 && latest) return call('/api/auth/refresh', {})
        throw e
      })
      .then(keep)
      .then(() => session)
      .catch((e) => {
        if (e.status === 401) { save(null); noSessionUntil = Date.now() + 30000 }
        return e.status === 401 ? null : session   // 네트워크 오류면 가진 것을 그대로
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

// 봇 방어 — 서버가 낸 문제를 웹 워커에서 풀어 함께 보낸다 (auth_service/app/botguard.py · 끈 서버면 bits 0 → 바로 통과)
async function proofOfWork() {
  const res = await fetch('/api/auth/challenge', { credentials: 'same-origin', cache: 'no-store' })
  if (!res.ok) return {}
  const { challenge, bits } = await res.json()
  if (!bits) return { powChallenge: challenge, powNonce: '0' }
  const nonce = await new Promise((resolve, reject) => {
    let w
    try {
      w = new Worker(new URL('./pow.worker.js', import.meta.url), { type: 'module' })
    } catch (e) {
      reject(e)
      return
    }
    const t = setTimeout(() => { w.terminate(); reject(new Error('보안 확인이 너무 오래 걸립니다 — 다시 시도해 주세요')) }, 60000)
    w.onmessage = (e) => { clearTimeout(t); w.terminate(); resolve(e.data?.nonce) }
    w.onerror = (e) => { clearTimeout(t); w.terminate(); reject(new Error(e.message || '보안 확인 실패')) }
    w.postMessage({ challenge, bits })
  })
  return { powChallenge: challenge, powNonce: nonce }
}

// 문제가 만료 · 재사용으로 거절되면(409) 한 번 새 문제로
async function callWithPow(path, body) {
  try {
    return await call(path, { ...body, ...(await proofOfWork()) })
  } catch (e) {
    if (e.status !== 409 || !String(e.code || '').startsWith('pow_')) throw e
    return call(path, { ...body, ...(await proofOfWork()) })
  }
}

// 초대 링크로 왔던 기기 — 가입할 때 초대한 사람 닉네임을 함께 (invite.js INVITER_KEY · 14일 지나면 버림)
const INVITER_KEY = 'mg.invite.from'
function invitedBy() {
  try {
    const v = JSON.parse(localStorage.getItem(INVITER_KEY) || 'null')
    return v?.from && Date.now() - (v.at || 0) < 14 * 86400 * 1000 ? String(v.from).slice(0, 32) : null
  } catch {
    return null
  }
}

export async function register(nickname) {
  const inviter = invitedBy()
  const data = await callWithPow('/api/auth/register', { nickname, age14: ageConfirmed(), ...(inviter && inviter !== nickname ? { invitedBy: inviter } : {}) })
  try { localStorage.removeItem(INVITER_KEY) } catch { /* */ }
  keep(data, { fresh: true })
  await mergeGuest()
  return data.recoveryCode
}

export async function recover(code) {
  const data = keep(await callWithPow('/api/auth/recover', { recoveryCode: code }), { fresh: true })
  await mergeGuest()
  return data
}

// ------------------------------------------------------------------ 손님 (로그인 없이 플레이 — reports/design_guest_play.md · 플랫폼 F-2)
//   features.js 의 guestPlay 가 켜져 있을 때만. 계정이 없으면 손님 토큰(인증 서비스 /api/v1/auth/guest · 봇 방어 · 30일)을 조용히 받아
//   게임 서버 API 에만 붙인다 (계정 API 는 손님 토큰을 받지 않는다). 만료 7일 전에 같은 손님 ID 로 갱신, 만료되면 새 손님
//   로그인(가입 · 복구)하면 손님일 때 연 재판을 계정으로 옮기고(merge-guest) 손님 토큰을 지운다. 손님 EXP 는 account/xp.js 대기열이 합친다
const GUEST_KEY = 'mg.guest'
const GUEST_RENEW_MS = 7 * 24 * 3600 * 1000
let guest = loadGuest()
let guestPending = null
let noAccount = false
onSession(() => { noAccount = false })
function loadGuest() {
  try {
    const g = JSON.parse(localStorage.getItem(GUEST_KEY) || 'null')
    return g?.token && g.expiresAt ? g : null
  } catch {
    return null
  }
}
function saveGuest(g) {
  guest = g
  try {
    if (g) localStorage.setItem(GUEST_KEY, JSON.stringify(g))
    else localStorage.removeItem(GUEST_KEY)
  } catch { /* 저장 불가 — 이 탭에서만 */ }
}
const keepGuest = (d) => saveGuest({ token: d.guestToken, id: d.guestId, expiresAt: Date.now() + (d.expiresIn - 60) * 1000 })
export const guestNow = () => (guest && guest.expiresAt > Date.now() ? guest : null)

// 손님 토큰 — 있으면 그대로(만료가 가까우면 갱신), 없거나 만료면 새로. 실패하면 null (화면은 로그인 안내로)
export async function ensureGuest() {
  if (!guestNow() && !ageConfirmed()) return null      // 만 14세 이상 확인 전에는 손님 토큰도 만들지 않는다 (2026-11-24 법 검토)
  const g = guestNow()
  if (g && g.expiresAt - Date.now() > GUEST_RENEW_MS) return g
  if (!guestPending) {
    guestPending = (async () => {
      if (g) {
        try {
          const res = await fetch('/api/v1/auth/guest/refresh', { method: 'POST', headers: { Authorization: `Bearer ${g.token}` } })
          const d = res.ok ? await res.json().catch(() => null) : null
          if (d?.guestToken && d.expiresIn) { keepGuest(d); return guest }
        } catch { /* 아래에서 새로 */ }
        if (g.expiresAt > Date.now()) return g      // 갱신만 실패 — 아직 쓸 수 있으면 그대로
      }
      keepGuest(await callWithPow('/api/v1/auth/guest', { age14: true }))
      return guest
    })().catch(() => null).finally(() => { guestPending = null })
  }
  return guestPending
}

// 게임 서버 API 용 머리 — 계정이 있으면 계정 토큰, 없고 손님 플레이가 켜져 있으면 손님 토큰
export async function gameHeaders(guestOk = true) {
  if (session?.user || !guestOk) return authHeaders()
  if (!noAccount) {                              // 쿠키로 조용히 이어지는 계정이 먼저 (한 번 없다고 나오면 로그인할 때까지 다시 묻지 않는다)
    const s = await authHeaders()
    if (s.Authorization) return s
    noAccount = true
  }
  const g = await ensureGuest()
  return g ? { Authorization: `Bearer ${g.token}` } : {}
}

// 게임 서버 호출 — 401 이면 계정은 갱신 후 한 번 더, 손님은 만료된 토큰이면 새로 받아 한 번 더
export async function withGameAuth(doFetch, guestOk = true) {
  let res = await doFetch(await gameHeaders(guestOk))
  if (res.status === 401) {
    if (session) {
      session = { ...session, expiresAt: 0 }
      res = await doFetch(await gameHeaders(guestOk))
    } else if (guestOk && guest) {
      if (guest.expiresAt <= Date.now() + 60000) saveGuest(null)
      else guest = { ...guest, expiresAt: Date.now() + GUEST_RENEW_MS - 1 }   // 갱신을 한 번 시도하게
      res = await doFetch(await gameHeaders(guestOk))
    }
  }
  return res
}

// 로그인 직후 — 손님일 때 연 재판을 이 계정으로 (계정 토큰 + 손님 토큰 둘 다 있어야 서버가 옮긴다). 실패해도 로그인은 그대로
export async function mergeGuest() {
  const g = guest
  if (!g?.token || !session?.accessToken) return null
  try {
    const res = await fetch('/api/v1/trials/merge-guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({ guestToken: g.token }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok || res.status === 400) saveGuest(null)    // 옮겼거나 이미 쓸 수 없는 손님 토큰 — 더 들고 있을 이유가 없다
    return res.ok ? data : null
  } catch {
    return null
  }
}

export async function checkNickname(name) {
  const res = await fetch(`/api/auth/nickname?name=${encodeURIComponent(name)}`)
  return res.json()
}

export async function authHeaders() {
  const s = await ensureSession()
  if (!s?.accessToken) return {}
  // 운영자 미리보기를 켠 운영자만 이 머리를 붙인다 — 서버가 예약 · 점검 사건을 여는 신호 (없으면 일반 사용자와 같게)
  return { Authorization: `Bearer ${s.accessToken}`, ...(previewOn(s.user) ? { [PREVIEW_HEADER]: '1' } : {}) }
}

// 401(만료)이면 한 번 갱신하고 다시
export async function withAuthRetry(doFetch) {
  let res = await doFetch(await authHeaders())
  if (res.status === 401 && session) {
    session = { ...session, expiresAt: 0 }
    res = await doFetch(await authHeaders())
  }
  return res
}

export async function fetchMe() {
  if (!session?.user && noAccount) throw new Error('로그인하면 내 기록을 볼 수 있어요')   // 손님 — 계정 API 를 부르지 않는다
  const res = await withAuthRetry((h) => fetch('/api/me', { headers: h }))
  if (!res.ok) throw new Error('내 기록을 불러오지 못했어요')
  return res.json()
}

export async function fetchTiers() {
  return (await fetch('/api/ranks/tiers')).json()
}

// 복구 코드 재발급 — 내 닉네임으로 재확인 + 이 기기의 로그인(갱신 토큰)을 함께 보낸다. 다른 기기는 로그아웃된다
export async function rotateRecoveryCode(confirmNickname) {
  const res = await withAuthRetry((h) =>
    fetch('/api/me/recovery-code', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...h },
      body: JSON.stringify({ confirmNickname, refreshToken: (load() || session)?.refreshToken || undefined }),
    }),
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail?.message || '복구 코드를 다시 받지 못했어요')
  return data.recoveryCode
}


// 회원 탈퇴 — 내 닉네임을 그대로 입력해 확인 (비밀번호가 없는 계정). 성공하면 이 기기의 로그인도 지운다
export async function deleteAccount(confirmNickname) {
  const res = await withAuthRetry((h) =>
    fetch('/api/me/delete', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...h },
      body: JSON.stringify({ confirmNickname }),
    }),
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail?.message || '탈퇴하지 못했어요 — 잠시 후 다시 시도해 주세요')
  leaveDevice(session?.user?.id)   // 허브 최근 · 즐겨찾기도 지우고, 다른 게임 기록은 다음에 들어오는 계정에 섞이지 않게 표시 (account/owner.js)
  clearLocalData()
  save(null)
  return true
}

// 이 기기에 남은 게임 기록(재판 메모 · 조사 진행도 · 이어하기 · 초대 · 방문자 ID …)도 지운다 — 소리 · 화면 설정만 남김
function clearLocalData() {
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      // mg.moved(옛 주소에서 옮겨 받은 표시) · mg.moved.*(키 이사 표시)는 남긴다 — 지우면 옛 주소 · 옛 이름 기록을 또 받아 온다 (move/keys.js · platform/keys.js)
      //   aij.* = 공용 키 · 최후의 변론 기록의 옛 이름(2026-11 이름 바꾸기 — 정리 날짜 전까지 남아 있을 수 있다). 설정은 새 · 옛 이름 모두 남긴다
      if (!k) continue
      const keep = k === 'mg.settings' || k === 'aij.settings' || k === 'mg.moved' || k === 'aij.moved' || k.startsWith('mg.moved.') || k === KEY
      if ((k.startsWith('mg.') || k.startsWith('aij.') || k.startsWith('judge.')) && !keep) keys.push(k)   // judge.* = 최후의 변론 기록의 새 이름 (2026-11-26)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* 저장소를 못 쓰는 브라우저 — 지울 것도 없다 */
  }
}
