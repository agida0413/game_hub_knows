// '만 14세 이상입니다' 확인 한 칸 — 가입 화면 · 손님으로 시작하는 곳이 같은 값(storage.js ageConfirmed)을 쓴다
import { useEffect, useState } from 'react'
import { ageConfirmed, setAgeConfirmed } from '../storage.js'

export function useAge14() {
  const [on, setOn] = useState(ageConfirmed)
  useEffect(() => {
    const sync = () => setOn(ageConfirmed())
    window.addEventListener('mg:settings', sync)
    return () => window.removeEventListener('mg:settings', sync)
  }, [])
  return [on, (v) => setAgeConfirmed(v)]
}

export function AgeCheck({ className = '' }) {
  const [on, set] = useAge14()
  return (
    <div className={`age14 ${className}`}>
      <label className="age14-row">
        <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
        <span>만 14세 이상입니다</span>
      </label>
      {!on && <small className="age14-hint">만 14세 미만은 이용할 수 없어요</small>}
    </div>
  )
}
