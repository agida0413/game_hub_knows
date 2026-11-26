// 서버가 게임 상태를 바꾸면(liveStatus.js) 이 훅을 쓴 화면을 다시 그린다 — 허브 · 게임 문지기 · 점검 화면
import { useSyncExternalStore } from 'react'
import { onStatus, statusVersion } from './liveStatus.js'

export function useLiveStatus() {
  return useSyncExternalStore(onStatus, statusVersion, statusVersion)
}
