// 이 브라우저의 방문자 ID (방문 지표용) · 이어하기 — 플레이어 계정(닉네임 · 랭크)은 auth.js

const ID_KEY = 'mg.playerId'
const TRIAL_KEY = 'judge.activeTrial'

function safeGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function safeSet(key, value) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* 사생활 보호 모드 등 — 저장 없이 진행 */
  }
}

let memoryId = null
export function getPlayerId() {
  let id = safeGet(ID_KEY)
  if (!id) {
    id = memoryId || 'g_' + (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now()).replace(/-/g, '')
    memoryId = id
    safeSet(ID_KEY, id)
  }
  return id
}


// '이어서 재판' — 진행 중인 재판 (판결이 나면 지움)
export const getActiveTrial = () => {
  try {
    return JSON.parse(safeGet(TRIAL_KEY) || 'null')
  } catch {
    return null
  }
}
export const setActiveTrial = (info) => safeSet(TRIAL_KEY, info ? JSON.stringify(info) : null)
