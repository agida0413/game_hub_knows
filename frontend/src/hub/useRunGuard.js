// 저장되지 않는 판이 진행 중인 동안 켜 둔다 — 왼쪽 위 '허브' 단추가 나가기 전에 한 번 묻는다 (hub/hubback.js)
import { useEffect } from 'react'
import { setRunning } from './hubback.js'

export function useRunGuard(active) {
  useEffect(() => {
    setRunning(!!active)
    return () => setRunning(false)
  }, [active])
}
