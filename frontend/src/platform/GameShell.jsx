// 단독 실행 게임 껍데기 (2026-11-26 허브 유지 + 게임 독립) — App.jsx 가 /g/<게임> 화면을 이것으로 감싼다. 게임 코드는 손대지 않는다
//   · 기기 저장 키 이사(keys.js moveKeys — 게임이 저장소를 읽기 전에 한 번) · 계정 동기화(GameSync, 새 키 이름)
//   · 점검 · 준비 중이면 안내 화면(ProtoGate — 운영자는 들어감) · 게임 머리줄(GameBar) · 터치 방어(platform.css .mg-game)
import { Fragment, useEffect, useState } from 'react'
import GameSync from '../account/GameSync.jsx'
import ProtoGate from '../games/v2/ProtoGate.jsx'
import { go } from '../router.js'
import GameBar from './GameBar.jsx'
import HubBack from '../hub/HubBack.jsx'
import { HUB_HOME_TEMP } from '../hub/hubback.js'
import { moveKeys, syncKeys } from './keys.js'

export default function GameShell({ meta, children, onLeave }) {   // onLeave: '처음 화면'으로 나가기 전 (최후의 변론 법정은 휴정으로 저장)
  const [nonce, setNonce] = useState(() => { moveKeys(meta.id); return 0 })
  // 당겨서 새로고침 · 화면 튕김 막기 — 게임 화면이 떠 있는 동안만 문서 전체에 (도마 박자 bt-page 와 같은 처리, 듣개 없이 CSS 로만)
  useEffect(() => {
    const h = document.documentElement
    h.classList.add('mg-game-page')
    return () => h.classList.remove('mg-game-page')
  }, [])
  const restart = () => {
    if (onLeave) { try { onLeave() } catch { /* 저장 못 해도 나간다 */ } }
    go(`/${meta.id}`)
    setNonce((n) => n + 1)
  }
  return (
    <div className="mg-game" data-game={meta.id}>
      <ProtoGate id={meta.id}>
        {syncKeys(meta.id).length ? (
          <GameSync game={meta.id} keys={syncKeys(meta.id)}>
            <Fragment key={nonce}>{children}</Fragment>
          </GameSync>
        ) : <Fragment key={nonce}>{children}</Fragment>}   {/* 계정과 맞출 키가 없는 게임(도마 박자 — 기기에만)은 동기화하지 않는다 */}
      </ProtoGate>
      {HUB_HOME_TEMP ? <HubBack forceGame={meta.id} /> : <GameBar meta={meta} onRestart={restart} />}   {/* 임시(11/26): '홈' → 허브 */}
    </div>
  )
}
