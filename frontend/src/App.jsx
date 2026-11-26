// 「AI KNOWS YOU」 단독 앱 — 첫 화면(/)과 /g/knows 모두 이 게임. 약관 · 처리방침만 따로 연다
//   막간(게임 모음)에서 떼어 온 껍데기: 게임 머리줄 · 저장 키 이사 · 점검 안내는 GameShell(platform/)
import { lazy, Suspense, useEffect } from 'react'
import meta from './games/v2/knows/game.json'

import Legal from './components/Legal.jsx'
import GameShell from './platform/GameShell.jsx'
import './platform/platform.css'
import { useRoute } from './router.js'
import { keepAlive } from './sound.js'
import { loadOnce } from './lazyLoad.js'

const Game = lazy(() => loadOnce(() => import('./games/v2/knows/Proto.jsx')))

export default function App() {
  const route = useRoute()
  useEffect(() => keepAlive(), [])
  if (route.name === 'privacy' || route.name === 'terms') {
    return <div className="screen screen-legal" key={route.name}><Legal doc={route.name} /></div>
  }
  const id = route.name === 'knows' ? route.id : null
  return (
    <Suspense fallback={<div className="loading-screen" aria-busy="true" />}>
      <div className="screen screen-knows" key={'knows' + (id || '') + (route.sub || '')}>
        <GameShell meta={meta}><Game  /></GameShell>
      </div>
    </Suspense>
  )
}
