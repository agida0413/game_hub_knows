// 결과 화면 끝 '다른 게임' 입구 — 게임 화면에서 막간의 다른 게임으로 가는 길은 이것 하나 (2026-11-26 사용자 승인)
//   허브(막간 첫 화면)로 간다. 지표: ab91_<게임>_more (허브 단추 ab91_<게임>_hub 과 나란히)
import { LayoutGrid } from 'lucide-react'
import { useEffect } from 'react'
import { track } from './index.js'

export default function MoreGames({ game, className = '' }) {
  // 결과 화면 끝이 떴다 — 홈 화면에 추가 권유(InstallHint)가 이 신호로 때를 안다 (플레이 중에는 이 단추가 없다)
  useEffect(() => { try { window.dispatchEvent(new CustomEvent('mg:result', { detail: { game } })) } catch { /* 무시 */ } }, [game])
  const go = () => {
    track(game, 'ab', { label: `ab91_${game}_more` })
    window.location.href = '/#/hub'
  }
  return (
    <button type="button" className={`mg-more ${className}`.trim()} data-act="more-games" onClick={go}>
      <LayoutGrid size={18} strokeWidth={2.2} aria-hidden />
      <span>다른 게임</span>
    </button>
  )
}
