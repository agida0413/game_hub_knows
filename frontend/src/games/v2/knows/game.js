// 「숨긴 사진」 한 판 진행 — 순수 상태 기계 (react 없음 · 모든 시간은 now(ms) 로 받는다 · node --test 로 검증)
//   흐름: 표지(사다리), [도전], 사진 N장 3초(몰래 하나), [골랐어요], 빠른 진행, (확신 낮으면 다시 보기 — 둘 중 하나 · 셋 중 하나,
//         단계에 따라 여러 번), 봉투 공개, [맞아요] 또는 [아니, 이거], 라운드 결과, 라운드를 다 하면 끝 화면
//   한 판의 숫자(사진 수 · 반복 · 빠르기 · 라운드 수)는 AI 단계(ladder.js)에서, 라운드마다 사진은 열린 세트(sets.js)에서 뽑는다
//   반응 시간 원자료(trials)는 라운드 판정이 끝나면 상태에서 지운다. 남기는 것은 사진별 요약(늦어진 ms · 순위)뿐
import { HABIT_OPT, LEARN_BASE, LEAD_IN, MIN_RT, MIN_SOA, bars, buildSequence, expected, habitChannels, habitInit, habitUpdate, judgeRound, rngOf, shuffle, tieRank } from './engine.js'
import { DAILY, needOf, openSets, setUnlockedBy, stageCfg, wonGame } from './ladder.js'
import { SET_BY_ID, SET_SIZE, askLine, hasBatchim } from './sets.js'

export { askLine, hasBatchim }

export const SHOW_MS = 3000       // 사진을 보여 주는 최소 시간 — 이 뒤에 [골랐어요]
export const LOAD_WAIT_MS = 7000  // 사진이 끝내 안 받아질 때(깨진 파일 · 끊김) SHOW_MS 뒤로 더 기다리는 상한

// 이 라운드 사진 파일이 다 받아졌나 — 색 · 도형(코드로 그림)은 건너뛴다. 실패해도 '끝'으로 친다(기다림만 끝낸다)
//   느린 망에서 안 받아진 사진이 빠른 진행에 빈칸으로 뜨면 그 사진만 손이 늦어 AI 가 그 사진을 골랐다 (11/25 전체 시험)
//   make: 시험용 이미지 만들기(기본 브라우저 Image)
export function photosReady(items, make = () => new Image()) {
  const srcs = [...new Set((items || []).filter((it) => it && it.src).map((it) => it.src))]
  return Promise.all(srcs.map((src) => new Promise((res) => {
    try {
      const im = make()
      im.onload = () => res(true)
      im.onerror = () => res(false)
      im.src = src
      if (im.complete && im.naturalWidth > 0) res(true)
    } catch { res(false) }
  })))
}
export const TB_INTRO_MS = 1600   // '둘 중 하나' 안내
export const END_PAUSE = 450      // 마지막 칸 뒤 숨 고르기
export const START_SETS = ['thing', 'place', 'color']   // 첫 단계는 늘 이 순서(처음 하는 사람의 한 판이 그대로)

const range = (n) => Array.from({ length: n }, (_, i) => i)
const seedFor = (seed, round, part) => (seed + round * 7919 + part * 104729) >>> 0

/**
 * 한 판 설계 — 단계 값 + 라운드마다 세트 · 사진
 * @param o { seed, stage(도전 단계), best(깬 가장 높은 단계), daily({ set } — 오늘의 판) }
 * @returns { cfg, stage, daily, rounds: [{ set, items: [세트 안 사진 번호] }] }
 *   - 첫 단계(아직 아무것도 못 깸): 물건 · 장소 · 색
 *   - 그 뒤: 가장 최근에 열린 세트를 첫 라운드에(보상이 바로 보이게), 나머지는 열린 세트에서 씨앗으로 섞어 겹치지 않게
 *   - 오늘의 판: 모든 라운드가 오늘의 세트, 라운드마다 다른 장들
 */
export function planGame({ seed = 1, stage = 1, best = 0, daily = null } = {}) {
  const cfg = daily ? DAILY : stageCfg(stage)
  const rng = rngOf((seed ^ 0x5bd1e995) >>> 0)
  let sets
  if (daily) sets = Array(cfg.rounds).fill(daily.set)
  else if ((best | 0) === 0) sets = START_SETS.slice(0, cfg.rounds)
  else {
    const fresh = setUnlockedBy(best | 0)
    const rest = shuffle(openSets(best).map((s) => s.id).filter((id) => !fresh || id !== fresh.id), rng)
    sets = (fresh ? [fresh.id, ...rest] : rest).slice(0, cfg.rounds)
  }
  const rounds = sets.map((set) => ({ set, items: shuffle(range(SET_SIZE), rng).slice(0, cfg.n) }))
  return { cfg, stage: daily ? 0 : cfg.stage, daily: !!daily, rounds }
}

// 이 라운드의 사진들 (화면 순서 = 엔진의 0..n-1)
export function photosOf(st, round = st.round) {
  const r = st.rounds[round]
  const set = SET_BY_ID[r.set]
  return r.items.map((i) => set.items[i])
}

export function init(seed = 1, opt = {}) {
  const plan = planGame({ seed, ...opt })
  return {
    phase: 'cover', seed, stage: plan.stage, daily: plan.daily, cfg: plan.cfg, rounds: plan.rounds,
    round: 0, ai: 0, me: 0, results: [], firstGame: opt.firstGame ?? true, priorScale: null, habit: opt.habit || habitInit(), sig: null,
  }
}

function startRound(st, round, now) {
  const items = range(st.cfg.n)
  return {
    ...st, phase: 'show', round, shownAt: now,
    block: 'main', seq: buildSequence(items, st.cfg.reps, rngOf(seedFor(st.seed, round, 0)), st.cfg.isi), i: 0, on: false, onset: 0, lastOnset: -1e9, nextAt: 0,
    trials: [], mainTrials: null, tbList: [], pair: null, tbAt: 0, view: null, real: null, slip: null, presses: 0,
  }
}

// 다음 사진 시각 — 누른 뒤 흔든 간격, 그리고 사진이 바뀌는 간격 하한(MIN_SOA) 중 늦은 쪽
const nextOnset = (st, now) => Math.max(now + st.seq[st.i].isi, st.onset + MIN_SOA)

// slip(1초 가르침) 종류: wrong(버튼 틀림) · late(제한 시간 넘김) · early(사진이 뜨고 MIN_RT 안 — 보기 전에 누른 것이라 판정에서 버려진다.
//   알려 주지 않으면 연타하는 사람은 자기 칸이 다 버려지는 줄 모르고, AI 는 신호 없이 고른다)
function record(st, resp, rt, now, off, pd) {
  const tr = st.seq[st.i]
  const wrong = resp !== null && resp !== expected(tr)
  const early = resp !== null && !wrong && rt < MIN_RT
  return {
    ...st,
    trials: [...st.trials, { item: tr.item, target: tr.target, resp, rt, ...(Number.isFinite(off) ? { off } : {}), ...(Number.isFinite(pd) ? { pd } : {}) }],
    on: false, nextAt: nextOnset(st, now), i: st.i + 1, presses: st.presses + (resp ? 1 : 0),
    slip: wrong || early || resp === null ? { i: st.i, at: now, kind: resp === null ? 'late' : wrong ? 'wrong' : 'early' } : st.slip,
  }
}

// 진행 점 표시 — 맞게 눌렀고 판정에 쓰이는 칸만 d(청록), 틀림 · 늦음 · 너무 빠름은 x(빨강)
export const trialMark = (t) => (t.resp === expected(t) && !(Number.isFinite(t.rt) && t.rt < MIN_RT) ? 'd' : 'x')

function reveal(st, j, now, sigOn = false) {
  return {
    ...st, phase: 'reveal', revealAt: now,
    view: { guess: j.next.guess, ev: j.ev, order: j.post.order, bars: bars(j.main, range(st.cfg.n)), tb: j.tbs, sigOn },
    priorScale: j.main.scale, sig: j.sig,   // 사진별 신호 요약(원자료 아님)만 — 라운드 끝에 진짜 답과 맞춰 이 사람의 습관을 배운다
    trials: [], mainTrials: null, tbList: [], seq: [],   // 원자료는 여기서 버린다
  }
}

// tie: 신호가 하나도 없을 때(연타 · 안 누름 · 늘 '예') AI 가 고를 순서 — 라운드 씨앗에서(같은 판이면 같고, 판 · 라운드마다 다르다)
const judgeOpt = (st) => {
  const c = st.cfg
  return {
    deadline: c.deadline, tbMax: c.tbMax, confTb: c.confTb, tbK: c.tbK, channels: habitChannels(st.habit, LEARN_BASE, HABIT_OPT),
    tie: tieRank(range(c.n), rngOf(seedFor(st.seed, st.round, 97))),
    ...(st.priorScale ? { priorScale: st.priorScale } : {}),
  }
}

function finishBlock(st, now) {
  const all = range(st.cfg.n)
  const main = st.block === 'main' ? st.trials : st.mainTrials
  const tbList = st.block === 'main' ? [] : [...st.tbList, st.trials]
  const j = judgeRound(main, tbList, all, judgeOpt(st))
  if (j.next.action === 'tiebreak') {
    return { ...st, phase: 'tbIntro', tbAt: now, pair: j.next.pair, mainTrials: main, tbList, trials: [], on: false }
  }
  const ch = judgeOpt(st).channels
  return reveal(st, j, now, !!((ch.dw && ch.dw.d > 0) || (ch.off && ch.off.d > 0)))
}

function outcome(st, real) {
  const v = st.view
  const hit = real === v.guess
  const b = v.bars[real]
  const r = st.rounds[st.round]
  return {
    ...st, phase: 'done', real, sig: null, habit: st.sig ? habitUpdate(st.habit, st.sig, real, range(st.cfg.n)) : st.habit,
    ai: st.ai + (hit ? 1 : 0), me: st.me + (hit ? 0 : 1),
    results: [...st.results, { set: r.set, item: r.items[real], real, guess: v.guess, hit, rank: v.order.indexOf(real), ms: b.ms, frac: b.frac, ev: v.ev }],
  }
}

export function reduce(st, a) {
  switch (a.type) {
    case 'start': {
      // 표지나 끝 화면에서 — setup 이 있으면 그 단계 · 세트로 새 판(같은 단계 다시 · 다음 단계 · 오늘의 판)
      if (st.phase !== 'cover' && st.phase !== 'result') return st
      if (!a.setup && st.phase === 'result') return st
      return startRound(a.setup ? init(a.setup.seed, a.setup) : st, 0, a.now)
    }
    case 'cover':
      return st.phase === 'result' && a.setup ? init(a.setup.seed, a.setup) : st
    case 'picked':
      if (st.phase !== 'show' || a.now - st.shownAt < SHOW_MS) return st
      return { ...st, phase: 'run', i: 0, on: false, nextAt: a.now + LEAD_IN }
    case 'tick': {
      if (st.phase === 'tbIntro') {
        if (a.now - st.tbAt < TB_INTRO_MS) return st
        const seq = buildSequence(st.pair, st.cfg.tbReps, rngOf(seedFor(st.seed, st.round, 1 + st.tbList.length)), st.cfg.isi)
        return { ...st, phase: 'run', block: 'tb', seq, i: 0, on: false, trials: [], nextAt: a.now + LEAD_IN / 2 }
      }
      if (st.phase !== 'run') return st
      if (st.on) return a.now - st.onset >= st.cfg.deadline ? record(st, null, null, a.now) : st
      if (st.i < st.seq.length) {
        if (a.now < st.nextAt) return st
        return { ...st, on: true, onset: a.now, lastOnset: st.onset }
      }
      return a.now >= st.nextAt + END_PAUSE ? finishBlock(st, a.now) : st
    }
    case 'press': {
      if (st.phase !== 'run' || !st.on) return st
      const rt = Math.max(0, Math.round(a.now - st.onset))
      return record(st, a.kind === 'yes' ? 'yes' : 'no', rt, a.now, a.off, a.now)
    }
    case 'away': {
      // 화면이 숨겨졌다(다른 앱 · 알림 · 화면 끔) — 떠 있던 칸은 판정에서 뺀다(away). 그대로 두면 돌아올 때까지 시간이 흘러
      //   '늦음'(제한 시간 값)으로 잡혀 그 사진이 숨긴 사진처럼 보였다(1단계는 사진마다 '아니' 칸이 2개뿐이라 한 칸이 크다)
      if (st.phase !== 'run') return st
      if (!st.on) return { ...st, nextAt: Math.max(st.nextAt, a.now + LEAD_IN) }
      const tr = st.seq[st.i]
      return { ...st, trials: [...st.trials, { item: tr.item, target: tr.target, resp: null, rt: null, away: true }], on: false, i: st.i + 1, nextAt: a.now + LEAD_IN }
    }
    case 'back':
      // 돌아왔다 — 다음 사진까지 준비 시간(돌아오자마자 사진이 뜨면 그 칸도 늦는다)
      return st.phase === 'run' && !st.on ? { ...st, nextAt: Math.max(st.nextAt, a.now + LEAD_IN) } : st
    case 'release': {
      // 손을 뗀 시각 — 누른 시각(a.pd)이 같은 칸의 '손이 닿아 있던 시간'. 너무 짧거나 긴 값은 버린다
      const k = st.phase === 'run' ? st.trials.findIndex((t) => t.pd === a.pd) : -1
      const dw = a.now - a.pd
      if (k < 0 || !(dw >= 20 && dw <= 1500)) return st
      const trials = st.trials.slice()
      trials[k] = { ...trials[k], dw: Math.round(dw) }
      return { ...st, trials }
    }
    case 'yes':
      return st.phase === 'reveal' ? outcome(st, st.view.guess) : st
    case 'deny':
      return st.phase === 'reveal' ? { ...st, phase: 'pick' } : st
    case 'pick':
      return st.phase === 'pick' && Number.isInteger(a.item) && a.item >= 0 && a.item < st.cfg.n ? outcome(st, a.item) : st
    case 'next':
      if (st.phase !== 'done') return st
      if (st.round >= st.rounds.length - 1) return { ...st, phase: 'result', won: wonGame(st.rounds.length, st.me) }
      return startRound(st, st.round + 1, a.now)
    default:
      return st
  }
}

// ---- 끝 화면 · 공유 · 해설 ----

export const needFor = (st) => needOf(st.rounds.length)

// '+0.14초' — 0 이하는 빈 글
export const secText = (ms) => (ms > 0 ? `+${(ms / 1000).toFixed(2)}초` : '')

const eul = (w) => (hasBatchim(w) ? '을' : '를')

// 공유 문구 — 숫자와 단계만 (반응 시간 원자료 없음)
export function shareText({ ai, me, stage = 0, aiName = '', won = false, daily = false }) {
  if (daily) return `오늘의 판 AI ${ai} : 나 ${me}. 너는 숨길 수 있어?`
  if (won) return `AI ${stage}단계 '${aiName}'${eul(aiName)} 속였다 (AI ${ai} : 나 ${me}). 너는 몇 단계까지?`
  return `AI ${stage}단계 '${aiName}'에게 들켰다 (AI ${ai} : 나 ${me}). 너는 숨길 수 있어?`
}

// 졌을 때 한 줄 — 들킨 라운드 중 손이 가장 늦어진 값
export function loseLine(results) {
  const ms = Math.max(0, ...results.filter((r) => r.hit).map((r) => r.ms || 0))
  return ms > 0 ? `AI가 손이 늦어진 ${(ms / 1000).toFixed(2)}초를 읽었어요.\n한 번 더?` : 'AI가 손의 망설임을 읽었어요.\n한 번 더?'
}

// 마지막 해설 한 줄 — 지금은 mock 문장. 나중에 Claude 가 숫자 요약만 보고 쓴다(반응 시간 원자료는 넘기지 않는다)
//   ask: (prompt: string) => Promise<string> — 없거나 실패하면 mock
export function closingInput(results) {
  return {
    ai: results.filter((r) => r.hit).length,
    rounds: results.map((r) => ({ hit: r.hit, rank: r.rank + 1, lateMs: r.ms })),
  }
}
export function mockLine({ ai, rounds }) {
  const close = rounds.filter((r) => !r.hit && r.rank === 2).length
  const n = Math.min(5, Math.max(3, rounds.length))
  if (ai >= n) return `${['', '', '', '세', '네', '다섯'][n]} 번 다, 아니라고 할 때 손이 먼저 멈칫했어요.`
  if (ai * 2 > n) return '고르는 순간보다 아니라고 할 때 손이 더 솔직했어요.'
  if (ai >= 1) return close ? '한 번은 들켰고, 한 번은 아슬아슬했어요.' : '한 번은 손이 먼저 대답했어요.'
  return close ? '다 숨겼지만, 두 번째 의심까지는 갔어요.' : '손까지 숨기는 사람은 드물어요.'
}
export async function closingLine(results, ask) {
  const input = closingInput(results)
  if (typeof ask === 'function') {
    try {
      const line = String(await ask(JSON.stringify(input))).trim()
      if (line && line.length <= 60) return line
    } catch { /* mock 으로 */ }
  }
  return mockLine(input)
}
