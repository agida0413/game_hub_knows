// 허브 공용 계정 — 막간 의 모든 게임이 같은 계정(auth_service)을 쓴다 (2026-11-23 사용자 지시)
//   · 계정 등록 · 로그인은 허브에서 (#/account · 최후의 변론 입구도 같은 계정)
//   · 게임별 정보는 계정에 '확장'으로 붙인다 — /api/me/games/{game} (작은 JSON). 최후의 변론 아바타는 기존 /api/me/avatar 그대로
//   허브와 모든 게임이 이 폴더를 가져다 써도 된다 (src/games/README.md 예외)
import { useEffect, useState } from 'react'
import { checkNickname, currentUser, ensureSession, onSession, recover, register } from '../auth.js'

export { checkNickname, currentUser, ensureSession, onSession, recover, register }
// 게임 기록 계정 동기화 — loadGameData · saveGameData · syncGame (sync.js — 같은 기기 · 다른 계정 기록이 섞이지 않게 owner.js)
export { loadGameData, saveGameData, syncGame } from './sync.js'
// 허브 통합 점수(EXP) — awardXp(game, reason, key) · fetchMyXp() · fetchWeeklyRanks() (xp.js)
export { XP_EVENT, awardXp, claimMission, fetchMyXp, fetchWeeklyRanks, flushXpQueue, guestMission, queuedXp } from './xp.js'

// 지금 로그인한 사람 (없으면 null) — 로그인 · 로그아웃 · 탈퇴에 따라 바뀐다
export function useAccount() {
  const [user, setUser] = useState(currentUser)
  useEffect(() => {
    let alive = true
    ensureSession().then((s) => alive && setUser(s?.user || null)).catch(() => {})
    const off = onSession((s) => setUser(s?.user || null))
    return () => { alive = false; off?.() }
  }, [])
  return user
}
