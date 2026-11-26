// 코치 상태 기계 + 대본 검사 — react 없음(순수). 시험이 그대로 불러 쓴다 (Jenkins 시험은 react · lucide 를 설치하지 않음)
//   대본(TUTORIAL) 형식과 쓰는 법은 reports/tutorial_design.md 2-3 장.
//   이 파일이 불러오는 파일 · 각 게임의 tutorial.js 도 react · lucide-react · .jsx 를 import 하면 안 된다.
export const LINE_MAX = 15
export const AUTO_MIN = 1800
export const STEP_NO_MAX = 20   // 서버가 세는 tour_step 번호 상한

// 지표 이름에 쓸 수 있는 게임 (analytics.js GAMES 와 같은 칸)
export const TUTORIAL_GAMES = ['judge', 'future', 'search', 'room', 'knows', 'hub', 'beat', 'rules', 'edge', 'tim', 'train']

// 화면 글에 못 쓰는 것: 이모지 · 기호 · 화살표 · 글머리 기호 (글자 코드로 적는다 - 소스에 기호가 남지 않게)
const SYMBOL = /[\u2190-\u21FF\u2300-\u23FF\u25A0-\u27BF\u2900-\u29FF\u2B00-\u2BFF\uFE0F\u200D\uFF0B\u2039\u203A\u00AB\u00BB]|[\u{1F000}-\u{1FAFF}]/u
const HUB_WORD = '\uD5C8\uBE0C'   // 금지 낱말(쉬운 말은 '홈')
export const hasSymbol = (s) => SYMBOL.test(String(s || ''))

const asList = (u) => (Array.isArray(u) ? u : u == null ? [] : [u])

// '{a} 하나 골라요' 의 빈칸 채우기 — 빈칸이 안 채워졌거나 채운 뒤 15자를 넘으면 fallback(없으면 빈칸을 '이것' 으로 바꾼 문장)
export function fill(line, vars, fallback) {
  const base = String(line || '')
  let missing = false
  const out = base.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars && vars[k]
    if (v == null || v === '') { missing = true; return '' }
    return String(v)
  })
  if (!missing && [...out].length <= LINE_MAX) return out
  return fallback != null ? String(fallback) : base.replace(/\{\w+\}/g, '이것')
}

// 오류 문장 배열 (비어 있으면 통과). opts: { icons: ['Pointer', ...], varSets: [{a:'요일',b:'메뉴'}, ...] }
export function checkTutorial(t, opts = {}) {
  const errs = []
  const add = (m) => errs.push(m)
  if (!t || typeof t !== 'object') return ['대본이 없다']
  if (!TUTORIAL_GAMES.includes(t.game)) add(`game 이름이 지표 목록에 없다: ${t.game}`)
  if (!Number.isInteger(t.version) || t.version < 1) add('version 은 1 이상 정수')
  const steps = Array.isArray(t.steps) ? t.steps : []
  const lessons = t.lessons && typeof t.lessons === 'object' ? t.lessons : {}
  const max = t.game === 'judge' ? 6 : 5
  if (!(steps.length === 0 && Object.keys(lessons).length > 0) && (steps.length < 2 || steps.length > max)) {
    add(`단계는 2~${max}개 (지금 ${steps.length}개)`)
  }
  if (steps.length > STEP_NO_MAX + 1) add('단계 번호는 20 이하')
  const ids = new Set()
  const checkLine = (where, line, fallback) => {
    if (typeof line !== 'string' || !line.trim()) { add(`${where}: 문장이 없다`); return }
    const holes = line.match(/\{(\w+)\}/g) || []
    if (holes.length) {
      if (fallback == null) add(`${where}: 빈칸이 있으면 fallback 문장이 있어야 한다`)
      else checkLine(`${where}.fallback`, fallback)
      for (const vs of asList(opts.varSets)) {
        const f = fill(line, vs, fallback)
        if ([...f].length > LINE_MAX) add(`${where}: 채운 문장이 ${LINE_MAX}자를 넘는다 (${f})`)
        if (hasSymbol(f)) add(`${where}: 기호 문자 (${f})`)
      }
      return
    }
    if ([...line].length > LINE_MAX) add(`${where}: ${[...line].length}자 - ${LINE_MAX}자 이내 (${line})`)
    if (hasSymbol(line)) add(`${where}: 기호 · 화살표 · 이모지가 있다 (${line})`)
    if (line.includes(HUB_WORD)) add(`${where}: 쉬운 말('홈') 을 쓴다`)
  }
  const checkIcon = (where, icon) => {
    if (icon == null) return
    if (typeof icon !== 'string') { add(`${where}: icon 은 이름 문자열`); return }
    if (Array.isArray(opts.icons) && !opts.icons.includes(icon)) add(`${where}: 아이콘 표에 없는 이름 ${icon}`)
  }
  steps.forEach((s, i) => {
    const w = `단계 ${i}`
    if (!/^[a-z0-9]+$/.test(String(s.id || ''))) add(`${w}: id 는 영소문자 · 숫자`)
    else if (ids.has(s.id)) add(`${w}: id 겹침 ${s.id}`)
    ids.add(s.id)
    checkLine(w, s.line, s.fallback)
    checkIcon(w, s.icon)
    const until = asList(s.until)
    if (!until.length && s.autoMs == null) add(`${w}: until 이 없다 (사용자 조작이나 autoMs 가 있어야 다음으로 간다)`)
    if (until.some((u) => typeof u !== 'string' || !u)) add(`${w}: until 은 사건 이름 문자열`)
    if (s.autoMs != null && !(s.autoMs >= AUTO_MIN)) add(`${w}: autoMs 는 ${AUTO_MIN} 이상`)
    if (s.at != null && typeof s.at !== 'string') add(`${w}: at 은 자리 이름 문자열`)
    if (s.when != null && typeof s.when !== 'string') add(`${w}: when 은 상태 이름 문자열`)
  })
  for (const [id, l] of Object.entries(lessons)) {
    const w = `lesson ${id}`
    if (!/^[a-z0-9]+$/i.test(id)) add(`${w}: 이름은 영문 · 숫자`)
    checkLine(w, l.line, l.fallback)
    checkIcon(w, l.icon)
    if (l.autoMs != null && !(l.autoMs >= AUTO_MIN)) add(`${w}: autoMs 는 ${AUTO_MIN} 이상`)
    if (l.at != null && typeof l.at !== 'string') add(`${w}: at 은 자리 이름 문자열`)
  }
  return errs
}

// 대본의 at · until · lesson 이름이 화면 소스(글자)에 모두 나오는지 - 연결이 끊긴 이름을 잡는다
//   화면은 coach.at('이름') · coach.emit('이름') · coach.lesson('이름') 꼴로 쓴다
export function checkWiring(t, source) {
  const errs = []
  const src = String(source || '')
  const has = (fn, name) => new RegExp(`\\b${fn}\\(\\s*['"\`]${name}['"\`]`).test(src)
  for (const [i, s] of (t.steps || []).entries()) {
    if (s.at && !has('at', s.at)) errs.push(`단계 ${i}: at '${s.at}' 가 화면에 없다 (coach.at('${s.at}'))`)
    for (const u of asList(s.until)) if (!has('emit', u)) errs.push(`단계 ${i}: until '${u}' 를 보내는 곳이 없다 (coach.emit('${u}'))`)
  }
  for (const [id, l] of Object.entries(t.lessons || {})) {
    if (!has('lesson', id)) errs.push(`lesson ${id}: 부르는 곳이 없다 (coach.lesson('${id}'))`)
    if (l.at && !has('at', l.at)) errs.push(`lesson ${id}: at '${l.at}' 가 화면에 없다`)
  }
  return errs
}

// ---- 상태 기계 ----
//   cs: { i, active, done, skipped, state, shownAt, lesson: {id, at} | null, seen: [], firstMs, replays, now }
export function coachInit(t, { show = true, seen = [] } = {}) {
  const has = (t.steps || []).length > 0
  return { i: 0, active: !!show && has, done: false, skipped: false, state: null, shownAt: null,
    lesson: null, seen: [...seen], firstMs: null, replays: 0, now: 0 }
}

const stepVisible = (cs, t) => {
  if (!cs.active) return null
  const s = t.steps[cs.i]
  if (!s) return null
  if (s.when && s.when !== cs.state) return null
  return s
}

// shownAt 맞추기: 단계가 보이는 동안 처음 시각 · 안 보이면 null
function sync(cs, t, now) {
  const vis = stepVisible(cs, t)
  if (vis && cs.shownAt == null) return { ...cs, shownAt: now }
  if (!vis && cs.shownAt != null) return { ...cs, shownAt: null }
  return cs
}

function advance(cs, t, now) {
  const first = cs.i === 0 && cs.firstMs == null && cs.shownAt != null
  const base = { ...cs, firstMs: first ? Math.max(0, now - cs.shownAt) : cs.firstMs, shownAt: null }
  if (cs.i + 1 >= t.steps.length) return { ...base, active: false, done: true }
  return sync({ ...base, i: cs.i + 1 }, t, now)
}

// a: { type: 'emit', name, now } | { type: 'tick', now } | { type: 'state', name, now } | { type: 'skip' } | { type: 'replay' }
//    | { type: 'lesson', id, now } | { type: 'lessonEnd' }
export function coachReduce(cs, t, a) {
  const now = a.now ?? cs.now
  let n = { ...cs, now }
  switch (a.type) {
    case 'state':
      return sync({ ...n, state: a.name }, t, now)
    case 'emit': {
      const s = stepVisible(n, t)
      if (!s || !asList(s.until).includes(a.name)) return n
      return advance(n, t, now)
    }
    case 'tick': {
      n = sync(n, t, now)
      const s = stepVisible(n, t)
      if (s && s.autoMs != null && n.shownAt != null && now - n.shownAt >= s.autoMs) n = advance(n, t, now)
      const l = n.lesson && t.lessons && t.lessons[n.lesson.id]
      if (l && l.autoMs != null && now - n.lesson.at >= l.autoMs) n = { ...n, lesson: null }
      return n
    }
    case 'skip':
      return { ...n, active: false, skipped: true, shownAt: null }
    case 'replay':
      return sync({ ...coachInit(t, { show: true }), state: cs.state, replays: cs.replays + 1, now }, t, now)
    case 'lesson': {
      if (!t.lessons || !t.lessons[a.id] || n.seen.includes(a.id) || n.lesson) return n
      return { ...n, lesson: { id: a.id, at: now }, seen: [...n.seen, a.id] }
    }
    case 'lessonEnd':
      return n.lesson ? { ...n, lesson: null } : n
    default:
      return n
  }
}

// 지금 화면에 보여 줄 것 - 안 보일 때 null. lesson 이 있으면 그 문장이 먼저(단계는 기다림)
//   { id, kind: 'step' | 'lesson', step, index, total, paused, line, icon, at, closable }
export function coachView(cs, t, state, vars) {
  const total = (t.steps || []).length
  if (cs.lesson) {
    const l = (t.lessons || {})[cs.lesson.id]
    if (l) {
      return { id: cs.lesson.id, kind: 'lesson', step: null, index: -1, total, paused: false,
        line: fill(l.line, vars, l.fallback), icon: l.icon || null, at: l.at || null, closable: false }
    }
  }
  const s = stepVisible({ ...cs, state: state !== undefined ? state : cs.state }, t)
  if (!s) return null
  return { id: s.id, kind: 'step', step: s, index: cs.i, total, paused: !!s.pause,
    line: fill(s.line, vars, s.fallback), icon: s.icon || null, at: s.at || null, closable: true }
}
