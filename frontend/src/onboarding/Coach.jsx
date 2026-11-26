// 코치 화면 부품 — 게임의 안내 줄 자리에 넣는 한 줄(CoachLine) · 짚는 곳 위 손가락(CoachFinger) · 다시 보기 '?'(HelpButton)
//   빛 고리는 클래스 하나: <span className={coach.at('send') ? 'onb-glow' : ''}> (coach.css)
//   대본의 icon 이름은 아래 ICONS 표에 있어야 한다 - 시험이 이 표의 이름과 대본을 견준다. 새 이름은 import 와 표에 같이 더한다.
import {
  ArrowDown, Check, ChevronRight, CircleHelp, Clock, DoorOpen, Eye, EyeOff, Gauge, Heart, Hourglass, KeyRound,
  ListOrdered, Lock, Megaphone, MessageCircle, Music, Pointer, Search, Send, Square, Star, ThumbsUp, Timer, Users, X,
} from 'lucide-react'
import { openHowTo } from './howto.js'
import './coach.css'

const ICONS = {
  ArrowDown, Check, ChevronRight, Clock, DoorOpen, Eye, EyeOff, Gauge, Heart, Hourglass, KeyRound,
  ListOrdered, Lock, Megaphone, MessageCircle, Music, Pointer, Search, Send, Square, Star, ThumbsUp, Timer, Users, X,
}
export const COACH_ICONS = ICONS   // '?' 하는 법 카드(HowTo.jsx)도 같은 아이콘 표

export function CoachLine({ coach, theme = 'dark', className = '' }) {
  const v = coach && coach.view
  if (!v) return null
  const Icon = (v.icon && ICONS[v.icon]) || Pointer
  const isStep = v.kind === 'step'
  return (
    <div className={`onb-coach onb-coach-${theme}${isStep ? '' : ' lesson'} ${className}`.trim()} role="status" aria-live="polite" data-onb-coach={v.id}>
      <Icon className="onb-coach-ic" size={22} strokeWidth={2.2} aria-hidden />
      <span className="onb-coach-line">{v.line}</span>
      {isStep && v.closable ? (
        <button type="button" className="onb-coach-x" onClick={coach.skip} aria-label="안내 건너뛰기">
          <X size={20} strokeWidth={2.4} aria-hidden />
        </button>
      ) : null}
      {isStep && v.total > 1 ? (
        <span className="onb-coach-bar" aria-hidden>
          {Array.from({ length: v.total }, (_, k) => <i key={k} className={k <= v.index ? 'on' : ''} />)}
        </span>
      ) : null}
    </div>
  )
}

// 짚는 단추 안에 position:absolute 로 둔다. 터치 화면은 손가락, 마우스 화면은 화살표 커서(둘 다 직접 그린 SVG)
export function CoachFinger({ style, className = '' }) {
  return (
    <span className={`onb-finger ${className}`.trim()} style={style} aria-hidden="true">
      <svg className="onb-finger-hand" viewBox="0 0 26 38" width="26" height="38">
        <path d="M9 2.5a3.5 3.5 0 0 1 7 0V17h1.5a3 3 0 0 1 3 0 3 3 0 0 1 3 0A3 3 0 0 1 26 20v8c0 5-4 9.5-9.5 9.5h-1.5C10 37.5 7 35 5.5 31.5L1 23a2.6 2.6 0 0 1 4.3-2.8L9 24z" fill="#e8fbff" stroke="#04222a" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <svg className="onb-finger-cursor" viewBox="0 0 24 28" width="24" height="28">
        <path d="M3 2v20l5.200-4.600 3.300 7.600 3.400-1.500-3.300-7.400H19z" fill="#e8fbff" stroke="#04222a" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

// '?' 다시 보기 - 44x44, 표지 · 목록 머리줄 오른쪽에 둔다
//   누르면 어느 화면에서든 바로 '하는 법' 카드(howto.js — 지금 화면 대본, 또는 howto 로 넘긴 대본 · 줄)가 뜨고, 그다음 onClick(다음 판 단계 안내 다시 켜기 = coach.replay)
export function HelpButton({ onClick, theme = 'dark', className = '', style, label = '안내 다시 보기', howto }) {
  const press = (e) => { openHowTo(howto); if (onClick) onClick(e) }
  return (
    <button type="button" className={`onb-help onb-help-${theme} ${className}`.trim()} style={style} onClick={press} aria-label={label} title={label} data-help>
      <CircleHelp size={22} strokeWidth={2.2} aria-hidden />
    </button>
  )
}
