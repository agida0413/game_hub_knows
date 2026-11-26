// 코치 훅 — coach.js(상태 기계)에 저장 · 지표 · 시간을 묶는다. 쓰는 법: reports/tutorial_design.md 2-3 장
//   const coach = useCoach(TUTORIAL, { state: st.phase, vars: { a: '요일' }, already: () => 해 본 기록이 있나 })
//   게임은 coach.at('이름') 으로 손가락 · 빛을, coach.emit('사건') 으로 사용자 조작을, coach.paused 로 시계 멈춤을 처리한다.
//   안내 중이 아니면 emit 은 거의 공짜다. 저장이 안 돼도(사생활 모드) 게임은 그대로 돈다.
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { coachInit, coachReduce, coachView } from './coach.js'
import { AB_REPLAY, firstLabel, onbStore, shouldShow, track } from './index.js'
import { clearHowTo, setHowTo } from './howto.js'

const TICK_MS = 250
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export function useCoach(tutorial, { state, vars, already, store, enabled = true } = {}) {
  const t = tutorial
  const st = useMemo(() => store || onbStore(t.game), [store, t.game])
  const [cs, dispatch] = useReducer(
    (c, a) => coachReduce(c, t, a),
    null,
    () => {
      let seen = []
      let show = false
      try {
        const saved = st.read()
        seen = (saved && saved.seen) || []
        show = enabled && shouldShow(st, t.version, { already: !!(already && already()) })
      } catch { /* 저장 읽기 실패 - 안내 없이 */ }
      return coachInit(t, { show, seen })
    },
  )

  // 게임 상태 이름 (단계의 when 과 견주기)
  useEffect(() => { dispatch({ type: 'state', name: state, now: nowMs() }) }, [state])

  // '?' 하는 법 카드 — 이 화면의 대본을 등록해 둔다(빈칸 값 포함). 화면을 떠나면 지운다 (howto.js)
  useEffect(() => { setHowTo(t, vars); return () => clearHowTo(t) }, [t, vars])
  const view = useMemo(() => coachView(cs, t, state, vars), [cs, t, state, vars])
  const stepVisible = !!view && view.kind === 'step'

  // 자동으로 넘어가는 단계 · 사라지는 짚기가 있을 때만 시계를 돌린다
  const needTick = (stepVisible && view.step.autoMs != null) || !!cs.lesson
  useEffect(() => {
    if (!needTick) return undefined
    const id = setInterval(() => dispatch({ type: 'tick', now: nowMs() }), TICK_MS)
    return () => clearInterval(id)
  }, [needTick])

  // ---- 저장 · 지표: 단계가 바뀐 만큼만, 같은 번호는 두 번 보내지 않는다 ----
  const sent = useRef({ started: false, step: -1, done: false, skip: false, first: false, replays: 0, seen: cs.seen.length })
  useEffect(() => {
    const s = sent.current
    if (cs.replays !== s.replays) {
      s.replays = cs.replays
      s.started = false; s.step = -1; s.done = false; s.skip = false
    }
    if (stepVisible && view.index !== s.step) {
      if (!s.started) { s.started = true; track(t.game, 'start') }
      s.step = view.index
      track(t.game, 'step', view.index)
      try { st.write({ tutorialVersion: t.version, lastStep: view.index }) } catch { /* 저장 불가 */ }
    }
    if (cs.firstMs != null && !s.first) {
      s.first = true
      let had = false
      try { had = !!(st.read() || {}).first } catch { /* 저장 불가 */ }
      if (!had) {
        track(t.game, firstLabel(cs.firstMs))
        try { st.write({ first: 1 }) } catch { /* 저장 불가 */ }
      }
    }
    if (cs.done && !s.done) {
      s.done = true
      track(t.game, 'done')
      try { st.write({ tutorialCompleted: true, tutorialVersion: t.version, lastStep: Math.max(0, t.steps.length - 1), completedAt: new Date().toISOString() }) } catch { /* 저장 불가 */ }
    }
    if (cs.skipped && !s.skip) {
      s.skip = true
      track(t.game, 'skip')
      try { st.write({ skipped: true, tutorialVersion: t.version, lastStep: cs.i }) } catch { /* 저장 불가 */ }
    }
    if (cs.seen.length !== s.seen) {
      s.seen = cs.seen.length
      try { st.write({ seen: cs.seen }) } catch { /* 저장 불가 */ }
    }
  }, [cs, view, stepVisible, st, t])

  // ---- 게임이 쓰는 것 ----
  const activeRef = useRef(false)
  activeRef.current = cs.active
  const emit = useCallback((name) => {
    if (!activeRef.current) return
    dispatch({ type: 'emit', name, now: nowMs() })
  }, [])
  const lesson = useCallback((id) => { dispatch({ type: 'lesson', id, now: nowMs() }) }, [])
  const skip = useCallback(() => { dispatch({ type: 'skip', now: nowMs() }) }, [])
  const replay = useCallback(() => {
    let first = false
    try { first = !!(st.read() || {}).first } catch { /* 저장 불가 */ }
    try { st.reset() } catch { /* 저장 불가 */ }
    if (first) { try { st.write({ first: 1 }) } catch { /* 저장 불가 */ } }   // 첫 행동 시간은 기기에서 한 번만 잰다
    track(t.game, AB_REPLAY)
    dispatch({ type: 'replay', now: nowMs() })
  }, [st, t.game])
  const at = useCallback((name) => !!view && view.at === name, [view])
  const is = useCallback((id) => stepVisible && view.id === id, [view, stepVisible])

  return {
    active: cs.active,
    view,
    step: stepVisible ? view.step : null,
    index: view ? view.index : cs.i,
    total: t.steps.length,
    line: view ? view.line : '',
    icon: view ? view.icon : null,
    paused: !!view && view.paused,
    at, is, emit, lesson, skip, replay,
  }
}
