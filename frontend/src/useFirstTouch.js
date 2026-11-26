// 첫 터치 뒤 한 번 — 브라우저는 사용자가 누르기 전에는 소리를 막는다. 표지 · 고르기 화면의 배경음악을 첫 터치(손가락 · 키)에 시작할 때 쓴다.
//   active 가 참인 동안만 기다리고, 한 번 불리면 스스로 거둔다. fn 은 늘 최신 것을 부른다.
import { useEffect, useRef } from 'react'

export function useFirstTouch(active, fn) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined
    const h = () => { try { ref.current() } catch { /* 소리 없이 진행 */ } }
    window.addEventListener('pointerdown', h, { capture: true, passive: true, once: true })
    window.addEventListener('keydown', h, { capture: true, once: true })
    return () => {
      window.removeEventListener('pointerdown', h, { capture: true })
      window.removeEventListener('keydown', h, { capture: true })
    }
  }, [active])
}
