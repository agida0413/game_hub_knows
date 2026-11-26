// 주소 라우터 (서버 설정 없이 새로고침·뒤로 가기 지원) — 해시 주소 + 단독 실행 게임의 /g/<게임> 주소
//   #/            사건 목록 (첫 화면)
//   #/archive     사건 보관소
//   #/case/:id    사건 브리핑
//   #/trial/:id   법정
//   #/records/:tab 나의 기록 · 순위(rank) · 티어표(tiers)
//   #/privacy · #/terms  개인정보 처리방침 · 이용약관 (로그인 없이)
//   #/future · #/future/:caseId · #/future/:caseId/:code   10초 뒤의 나 (로그인 없이)
//   #/search · #/search/:caseId · #/search/:caseId/:code   당신의 검색 기록은 거짓말을 한다 (로그인 없이)
//   /g/room · /g/room/:id · /g/room/:id/:code   다들 언제 돼? — 단독 실행 게임은 '#' 없는 /g/<게임> 주소 그대로 (routes.js STANDALONE)
//   #/m · #/m/new · #/m/case/:id · #/m/join/:token · #/m/share/:id   실화 법정 (고소장 접수 데모)
import { useEffect, useState } from 'react'
import { adoptPrettyPath } from './pretty.js'
import { canonicalUrl, parseLocation, urlFor } from './routes.js'

// '#' 없는 짧은 주소(/privacy · /beat …)로 들어오면 해시 주소로 바꿔 연다 — 규칙은 pretty.js (2026-11-25)
adoptPrettyPath()
// 게임 주소 바로잡기 — 옛 해시 주소(#/room)는 /g/room 으로, 아직 옮기지 않은 게임의 /g/<게임> 은 해시 주소로 (routes.js canonicalUrl)
const ROUTE_EVENT = 'mg:route'
function adoptGameUrl() {
  try {
    const to = canonicalUrl(window.location)
    if (to) window.history.replaceState(window.history.state, '', to)
  } catch { /* 주소를 못 바꾸면 그대로 */ }
}
adoptGameUrl()

// 주소 읽기는 routes.js (react 없음 — 시험이 바로 부른다)
const parse = () => parseLocation(window.location)

export function useRoute() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const on = (e) => {
      adoptGameUrl()
      setRoute(parse())
      if (e.type !== 'popstate') window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    window.addEventListener('popstate', on)
    window.addEventListener(ROUTE_EVENT, on)
    return () => {
      window.removeEventListener('hashchange', on)
      window.removeEventListener('popstate', on)
      window.removeEventListener(ROUTE_EVENT, on)
    }
  }, [])
  return route
}

// 화면 이동 — 앱 경로('/hub' · '/room/abc'). 해시 화면끼리는 예전처럼 해시만 바꾸고, /g/<게임> 이 끼면 주소 기록(pushState)으로
export function go(path, { replace = false } = {}) {
  const url = urlFor(path)
  const onRoot = window.location.pathname === '/' || window.location.pathname === '/index.html'
  if (onRoot && url.startsWith('/#')) {
    const hash = url.slice(1)
    if (replace) window.location.replace(hash)
    else window.location.hash = hash
    return
  }
  if (replace) window.history.replaceState(null, '', url)
  else window.history.pushState(null, '', url)
  window.dispatchEvent(new Event(ROUTE_EVENT))
}
