// 게임 기록 계정 동기화 — react 없음 (node --test 로 시험: tests/account-owner.test.mjs). index.js 가 그대로 내보낸다
//   게임별 정보는 계정에 '확장'으로 붙인다 — /api/me/games/{game} (작은 JSON)
import { currentUser, ensureSession, withAuthRetry } from '../auth.js'
import { adoptGame, ownsDevice, readMark, writeMark } from './owner.js'
import { renameRemote } from '../platform/keys.js'   // 옛 키 이름으로 계정에 남은 기록 → 새 키 이름 (게임 독립 2단계)

export async function loadGameData(game) {
  const res = await withAuthRetry((h) => fetch(`/api/me/games/${game}`, { headers: h }))
  if (!res.ok) throw new Error('게임 기록을 불러오지 못했어요')
  return res.json()
}

export async function saveGameData(game, data) {
  const res = await withAuthRetry((h) => fetch(`/api/me/games/${game}`, {
    method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ data }),
  }))
  if (!res.ok) throw new Error('게임 기록을 저장하지 못했어요')
  return res.json()
}

// 기기에 저장하던 게임 기록(localStorage 키들)을 계정과 맞춘다 — 게임 코드는 그대로 두고, 게임 화면이 열릴 때 한 줄로 부른다
//   · 로그인 안 했으면 아무것도 안 함(지금처럼 기기에만)
//   · 열 때: 이 게임 기록을 다른 계정이 남겼으면(같은 기기 · 다른 계정) 먼저 지운다 — account/owner.js
//            계정 쪽이 이 기기보다 새로우면 기기로 받아 온다(다른 기기에서 한 기록) → onPulled() 로 화면을 다시 그린다
//   · 그 뒤: 화면을 떠나거나 숨길 때 · 30초마다 바뀐 것이 있으면 계정으로 올린다
//            처음 맞춘 계정으로만 올린다 — 맞추기 전(서버를 아직 못 읽음) · 그 사이 다른 계정으로 바뀌었으면 올리지 않는다
//            (맞추기 전에 올리면 다른 기기에서 쌓은 계정 기록을 이 기기 기록으로 덮어쓸 수 있다)
function snapshot(keys) {
  const out = {}
  try { for (const k of keys) { const v = localStorage.getItem(k); if (v != null) out[k] = v } } catch { /* 저장소 없음 */ }
  return out
}
export function syncGame(game, keys, { onPulled } = {}) {
  let alive = true
  let owner = null          // 계정 기록과 맞춘 계정 ID — 이 계정으로만 올린다
  let last = JSON.stringify(snapshot(keys))
  const push = async () => {
    const u = currentUser()
    if (!owner || !u || u.id !== owner || !ownsDevice(owner)) return   // 다른 탭에서 계정을 바꿨으면 이 탭은 올리지 않는다
    const now = JSON.stringify(snapshot(keys))
    if (now === last) return
    try {
      const r = await saveGameData(game, JSON.parse(now))
      last = now
      writeMark(game, owner, r.updatedAt)
    } catch { /* 다음에 다시 */ }
  }
  ;(async () => {
    const s = await ensureSession().catch(() => null)
    if (!alive || !s?.user) return
    const me = s.user.id
    if (!ownsDevice(me)) return                                 // 다른 탭에서 다른 계정으로 바꿈 — 이 탭은 손대지 않는다
    try {
      const wiped = adoptGame(game, keys, me) === 'wiped'     // 다른 계정이 남긴 이 게임 기록 — 새 계정에 섞지 않는다
      if (wiped) last = JSON.stringify(snapshot(keys))
      const remote = await loadGameData(game)
      if (currentUser()?.id !== me) return                     // 읽는 사이 계정이 바뀜 — 다음에 다시
      const mine = readMark(game)
      const local = snapshot(keys)
      const remoteNewer = remote.updatedAt && remote.updatedAt > mine
      owner = me
      if (remoteNewer && Object.keys(remote.data || {}).length) {
        for (const [k, v] of Object.entries(renameRemote(game, remote.data))) if (keys.includes(k) && typeof v === 'string') localStorage.setItem(k, v)
        writeMark(game, me, remote.updatedAt)
        last = JSON.stringify(snapshot(keys))
        if (alive) onPulled?.()
        return
      }
      if (wiped && alive) onPulled?.()                         // 앞 계정 기록을 지웠다 — 화면을 새로 그린다
      if (Object.keys(local).length) {
        last = ''          // 계정에 아직 없거나 이 기기가 더 새로움 → 바로 올린다
        push()
      }
    } catch { /* 서버 문제 — 기기 기록으로 계속 (맞추지 못했으니 이번에는 올리지 않는다) */ }
  })()
  const timer = setInterval(push, 30000)
  const onHide = () => { if (document.visibilityState === 'hidden') push() }
  document.addEventListener('visibilitychange', onHide)
  return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', onHide); push() }
}
