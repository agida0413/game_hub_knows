// 모든 게임 왼쪽 위 '허브' 단추 — 어느 주소에 붙일지 · 어떻게 나갈지 (react 없음 — node --test)
//   2026-11-24 사용자 지시: 이탈을 줄이려고 게임을 끝내거나 질려도 사이트를 떠나지 않고 다른 게임으로 가게
//   붙이는 곳은 이 한 곳의 목록뿐 — 나중에 생기는 #/knows · #/train 정식 경로도 목록에 이미 있다.
//   허브 · 계정 · 약관 · 준비 중(next) 화면에는 붙이지 않는다.

// 주소 첫 마디 → 게임 이름표 (지표 이름 'ab91_<이름표>_hub' 에 쓰므로 소문자 · 숫자 12자 이하)
const OWN = {
  archive: 'judge', case: 'judge', trial: 'judge', records: 'judge', m: 'judge',
  future: 'future', search: 'search', room: 'room', knows: 'knows', train: 'train',
}
// #/v2/<id> 시제품 — 어떤 id 든 게임이다 (새 시제품이 생겨도 자동으로 붙는다)
import { STANDALONE } from '../routes.js'

// 임시 스위치 (2026-11-26 사용자 "홈 → 허브로 이동, 다시 임시로 운영에 살려") — 켜면 단독 실행 게임도 왼쪽 위가 게임 메뉴(GameBar) 대신 '홈'(허브로) 단추.
//   끄면(false) 게임 독립 화면(GameBar)으로 돌아간다. 쓰는 곳: platform/GameShell.jsx
export const HUB_HOME_TEMP = true

export const NO_HUB_BACK = new Set(['hub', 'account', 'privacy', 'terms', 'next'])

// route: { name, id } · hubFirst: 첫 화면(#/ 나 '')이 허브였는가 (아니면 최후의 변론 사건 목록)
export function hubBackGame(route, hubFirst = true) {
  const name = route?.name || 'title'
  if (NO_HUB_BACK.has(name)) return null
  if (STANDALONE.includes(name)) return null   // 단독 실행 게임(/g/<게임>)은 허브 단추 대신 게임 머리줄 (platform/GameBar.jsx, 2026-11-26)
  if (name === 'title') return hubFirst || STANDALONE.includes('judge') ? null : 'judge'
  if (name === 'v2') return route.id && /^[a-z0-9]{1,12}$/.test(route.id) ? route.id : null
  const own = OWN[name] || null
  return own && STANDALONE.includes(own) ? null : own   // 최후의 변론(사건 목록 · 사건 · 법정 · 기록)도 단독 실행이면 게임 머리줄 (2026-11-26)
}

// 지표 이름 — 서버 규칙 ^ab[0-9]{1,2}_[a-z0-9]{1,12}_[a-z0-9]{1,12}$ (서버 변경 없음)
export const hubBackLabel = (game) => `ab91_${game}_hub`

// 진행 중인 판 — 게임이 켜 두는 표시 (저장되지 않는 판만. 최후의 변론 법정은 서버가 휴정으로 저장하므로 켜지 않는다)
let running = false
export const setRunning = (v) => { running = !!v }
export const isRunning = () => running
