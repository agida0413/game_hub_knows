// 게임 화면을 감싸 계정과 기기 기록을 맞춘다 — 게임 코드는 손대지 않는다 (App.jsx 에서 감쌈)
//   다른 기기에서 한 기록을 받아 오면 게임을 한 번 새로 그린다(기기 저장소를 다시 읽게)
import { Fragment, useEffect, useState } from 'react'
import { syncGame } from './index.js'

export default function GameSync({ game, keys, children }) {
  const [v, setV] = useState(0)
  useEffect(() => syncGame(game, keys, { onPulled: () => setV((n) => n + 1) }), [game]) // eslint-disable-line react-hooks/exhaustive-deps
  return <Fragment key={v}>{children}</Fragment>
}
