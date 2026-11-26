// '?' 하는 법 카드 — 어느 화면에서 '?' 를 눌러도 바로 뜬다 (2026-11-26 사용자 신고: '?' 를 눌러도 아무 일도 없음)
//   원인: '?' 는 코치를 0단계로 되돌리기만 했는데(replay), 그 단계의 when(게임 상태)이 지금 화면과 다르면 아무것도 안 보였다.
//   이제: '?' → 이 카드(그 게임 튜토리얼 대본의 단계 줄 · 아이콘, 3~4줄)를 바로 띄우고, 다음 판 단계 안내도 다시 켠다(replay).
//   react 없음 (node --test). 화면은 HowTo.jsx(App 에 하나). 지금 화면의 대본은 useCoach 가 열릴 때 등록한다(setHowTo)
import { fill } from './coach.js'

let current = null        // { tutorial, vars } — 지금 화면의 대본
let shown = null          // 떠 있는 카드 { game, title, lines: [{ line, icon }] }
let version = 0
const subs = new Set()
const emit = () => { version += 1; for (const fn of subs) { try { fn() } catch { /* 구독자 하나가 실패해도 나머지 */ } } }

export function setHowTo(tutorial, vars) { current = tutorial ? { tutorial, vars } : null }
export function clearHowTo(tutorial) { if (current && current.tutorial === tutorial) current = null }
export const currentHowTo = () => current

// 대본 → 카드 줄 (단계 줄 · 아이콘, 많아야 4줄 · 빈칸은 채우거나 fallback)
export function howToLines(tutorial, vars) {
  const steps = (tutorial && tutorial.steps) || []
  return steps.slice(0, 4).map((s) => ({ line: fill(s.line, vars || {}, s.fallback), icon: s.icon || 'Pointer' })).filter((x) => x.line)
}

// 카드 띄우기 — 대본(없으면 지금 화면 대본) 또는 줄 목록을 직접. 띄웠으면 true
export function openHowTo(arg) {
  let card = null
  if (arg && Array.isArray(arg.lines)) card = { game: arg.game || '', title: arg.title || '하는 법', lines: arg.lines.slice(0, 4) }
  else {
    const t = arg && arg.steps ? { tutorial: arg, vars: undefined } : current
    if (t) card = { game: t.tutorial.game || '', title: '하는 법', lines: howToLines(t.tutorial, t.vars) }
  }
  if (!card || !card.lines.length) return false
  shown = card
  emit()
  return true
}
export function closeHowTo() { if (shown) { shown = null; emit() } }
export const howToShown = () => shown
export const howToVersion = () => version
export function onHowTo(fn) { subs.add(fn); return () => { subs.delete(fn) } }
