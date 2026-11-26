// 유입 꼬리표(?src=채널) — 처음 들어온 주소의 src 를 기기에 한 번만 저장하고, '어느 채널에서 와서 첫 판을 했나'를 센다
//   src 는 영문 · 숫자 12자까지(소문자로). 개인정보 없음 — 기기 무작위 ID 와 채널 이름만 서버로 간다
//   세는 길은 기존 A/B 이름 규칙(analytics.js · 서버 game_stats.record_ab): ab90_<채널>_open(그 게임을 처음 연 기기) · ab90_<채널>_start(그 게임 첫 판)
//   저장은 30일 — 지나면 새 주소의 src 로 바꾼다. 같은 게임 · 같은 단계는 기기당 한 번만 센다. 저장이 안 되는 브라우저는 세지 않는다
import { publicOrigin } from './site.js'

const KEY = 'mg.src'
const DAYS = 30
export const SRC_AB_NO = 90
export const cleanSrc = (s) => (/^[A-Za-z0-9]{1,12}$/.test(String(s || '')) ? String(s).toLowerCase() : '')

function read(store) {
  try { return JSON.parse(store.getItem(KEY) || 'null') } catch { return null }
}
function write(store, v) {
  try { store.setItem(KEY, JSON.stringify(v)) } catch { /* 저장 불가 — 이 기기는 채널을 세지 않음 */ }
}

// 앱이 뜰 때 한 번 — 주소의 ?src= 를 저장하고(이미 있으면 그대로) 주소창에서는 지운다
export function captureSrc(loc = typeof window !== 'undefined' ? window.location : null,
  store = typeof localStorage !== 'undefined' ? localStorage : null, hist = typeof window !== 'undefined' ? window.history : null, now = Date.now()) {
  if (!loc || !store) return null
  let src = ''
  try {
    const p = new URLSearchParams(loc.search || '')
    src = cleanSrc(p.get('src'))
    if (p.has('src') && hist && hist.replaceState) {
      p.delete('src')
      const q = p.toString()
      hist.replaceState(null, '', `${loc.pathname}${q ? `?${q}` : ''}${loc.hash || ''}`)
    }
  } catch { /* 주소를 못 읽으면 건너뜀 */ }
  const prev = read(store)
  const fresh = prev && prev.src && now - (prev.at || 0) <= DAYS * 86400000
  if (!fresh && src) {
    write(store, { src, at: now, done: [] })
    return src
  }
  return fresh ? prev.src : null
}

// 이 기기의 채널 지표 이름을 한 번만 — 'open' | 'start'. 이미 셌거나 채널이 없으면 null (센 것으로 기록한다)
export function takeSrcLabel(game, stage, store = typeof localStorage !== 'undefined' ? localStorage : null, now = Date.now()) {
  if (!store) return null
  const v = read(store)
  if (!v || !v.src || now - (v.at || 0) > DAYS * 86400000) return null
  const tag = `${game}:${stage}`
  if ((v.done || []).includes(tag)) return null
  write(store, { ...v, done: [...(v.done || []), tag].slice(-40) })
  return `ab${SRC_AB_NO}_${v.src}_${stage}`
}

// 이 기기의 채널 이름(30일 안) — 첫 판 알림 글에만 쓴다 (analytics.js 가 start 이벤트에 실어 보냄). 없으면 ''
export function currentSrc(store = typeof localStorage !== 'undefined' ? localStorage : null, now = Date.now()) {
  if (!store) return ''
  const v = read(store)
  return v && v.src && now - (v.at || 0) <= DAYS * 86400000 ? cleanSrc(v.src) : ''
}

// 공유 미리보기 주소 — 서버가 그 게임 제목 · 사진을 주고 바로 게임으로 보낸다 (go: 게임 안의 도전 주소 조각 '회차/코드')
// origin: 기본은 지금 주소 — 옛 주소(old.example.com)에서 열린 탭이면 새 주소로 (site.js publicOrigin)
export function shareLink(game, go = '', origin = publicOrigin()) {
  return `${origin}/g/${game}?src=share${go ? `&go=${encodeURIComponent(go)}` : ''}`
}
