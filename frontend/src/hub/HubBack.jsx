// 모든 게임 왼쪽 위 '허브' 단추 (2026-11-24) — 항상 #/hub 로 (#/ 는 마지막 게임으로 건너뛰므로 쓰지 않는다)
//   저장되지 않는 판이 진행 중이면(hubback.js setRunning) 한 번 묻는다. 최후의 변론 법정은 휴정으로 서버에 저장되므로 바로.
import { House } from 'lucide-react'
import { useEffect, useState } from 'react'
import { recessOnLeave } from '../api.js'
import { gameEvent } from '../analytics.js'
import { go } from '../router.js'
import { parseLocation } from '../routes.js'
import { hubBackGame, hubBackLabel, isRunning } from './hubback.js'
import './hubback.css'

// forceGame: 단독 실행 게임(GameShell)이 임시 스위치(HUB_HOME_TEMP)로 이 단추를 쓸 때 그 게임 id — route 는 지금 주소에서 읽는다
export default function HubBack({ route: routeProp, hubFirst, forceGame }) {
  const route = forceGame ? parseLocation(window.location) : routeProp
  const game = forceGame || hubBackGame(route, hubFirst)
  const [ask, setAsk] = useState(false)
  useEffect(() => { setAsk(false) }, [route.name, route.id, route.sub])
  if (!game) return null

  const leave = () => {
    gameEvent('hub', 'ab', undefined, hubBackLabel(game))
    if (route.name === 'trial') recessOnLeave(route.id)   // 법정은 휴정(이어 하기)으로 저장하고 나간다
    setAsk(false)
    go('/hub')
  }
  const press = () => { if (isRunning()) setAsk(true); else leave() }

  return (
    <>
      <button type="button" className="hubback" onClick={press} aria-label="홈으로 — 다른 게임 고르기" data-hubback={game}>
        <House size={18} strokeWidth={2.2} aria-hidden />
        <span>홈</span>
      </button>
      {ask && (
        <div className="hubback-ask" role="dialog" aria-modal="true" aria-label="홈으로 나갈까요"
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setAsk(false) } }}>
          <div className="hubback-card">
            <p>나가면 이번 판은 사라져요</p>
            <div>
              <button type="button" className="hubback-stay" onClick={() => setAsk(false)} autoFocus>계속하기</button>
              <button type="button" className="hubback-out" onClick={leave}>홈으로</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
