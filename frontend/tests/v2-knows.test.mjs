// 「AI KNOWS YOU · 숨긴 사진」 — 판정 엔진 · 시뮬레이션 적중률 하한 · 라운드 진행 · 깜빡임 · 원자료 비전송 · 금지 기호
//   (AI 단계 사다리 · 기록 · 단계별 적중률은 v2-knows-ladder.test.mjs)
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  CONF_TB, DEADLINE, ITEMS, LEAD_IN, MIN_SOA, REPS, TB_REPS, analyze, bars, buildSequence, decide, expected, judgeRound, posterior, rngOf,
} from '../src/games/v2/knows/engine.js'
import {
  END_PAUSE, SHOW_MS, START_SETS, TB_INTRO_MS, askLine, closingInput, closingLine, hasBatchim, init, loseLine, mockLine, photosOf, reduce, secText, shareText,
} from '../src/games/v2/knows/game.js'
import { SETS, SET_SIZE, SHAPES } from '../src/games/v2/knows/sets.js'
import { PROG_KEY, STAGES } from '../src/games/v2/knows/ladder.js'
import { simulate, simulateGames } from '../src/games/v2/knows/sim.js'

const ALL = [0, 1, 2, 3, 4]
const DIR = new URL('../src/games/v2/knows/', import.meta.url)

// 정해진 반응 시간으로 한 묶음 만들기 — rtOf(trial, k) 가 ms (null = 제한 시간 넘김)
function fake(seq, rtOf, respOf = (t) => expected(t)) {
  return seq.map((t, k) => {
    const rt = rtOf(t, k)
    return { item: t.item, target: t.target, resp: rt == null ? null : respOf(t, k), rt: rt == null ? null : rt }
  })
}
const jitter = (r, s = 60) => (r() - 0.5) * 2 * s

test('사진 세트 — 11개 · 세트마다 7장 · 파일 있음 · 세트 안 이름 겹침 없음 · 세트끼리 사진 중복 없음 · 자극적 이름 없음', () => {
  assert.equal(SETS.length, 11)
  assert.deepEqual(SETS.slice(0, 3).map((s) => s.id), START_SETS)
  assert.deepEqual(SETS.map((s) => s.name), ['물건', '장소', '색', '음식', '옆자리', '여행', '기념일', '책상', '집 안', '자연', '도형'])
  // 처음 세 개는 처음부터, 그 뒤로 1~8단계를 깰 때마다 하나씩
  assert.deepEqual(SETS.map((s) => s.unlock), [0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8])
  assert.equal(new Set(SETS.map((s) => s.id)).size, SETS.length)
  const srcs = new Set()
  for (const s of SETS) {
    assert.equal(s.items.length, SET_SIZE, s.id)
    assert.ok(SET_SIZE >= Math.max(...STAGES.map((x) => x.n)), '세트는 가장 높은 단계의 사진 수 이상')
    assert.equal(new Set(s.items.map((i) => i.id)).size, SET_SIZE, s.id)
    assert.equal(new Set(s.items.map((i) => i.name)).size, SET_SIZE, s.id)
    for (const it of s.items) {
      assert.ok(it.src || /^#[0-9a-f]{6}$/i.test(it.color) || SHAPES[it.shape], it.id)
      if (it.src) {
        assert.match(it.src, /^\/knows\/img\/[a-z0-9_]+\.webp$/, it.src)   // 자기 자산 폴더만 (2026-11-26 — 다른 게임 사진을 복사해 옴)
        assert.ok(existsSync(new URL('../public' + it.src, import.meta.url)), it.src)
        assert.ok(!srcs.has(it.src), `사진 중복 ${it.src}`)
        srcs.add(it.src)
      }
      assert.ok(!/알약|^약$|칼|흉기|총|담배|술|^피$|장례|병원|해킹/.test(it.name), it.name)
    }
  }
  // 색은 서로 다른 일곱 색
  assert.equal(new Set(SETS.find((s) => s.id === 'color').items.map((i) => i.color)).size, SET_SIZE)
  for (const f of ['img/stage.webp', 'img/cover.webp', 'music/loop.mp3', 'music/reveal.mp3']) {
    assert.ok(existsSync(new URL('../public/knows/' + f, import.meta.url)), f)
  }
})

test('묻는 말 — 받침에 따라 "열쇠죠?" · "양복이죠?" · 한 줄 짧게', () => {
  assert.equal(askLine('열쇠'), '열쇠죠?')
  assert.equal(askLine('양복'), '양복이죠?')
  assert.equal(askLine('차 안'), '차 안이죠?')
  assert.equal(hasBatchim('보라'), false)
  for (const s of SETS) for (const it of s.items) assert.ok(askLine(it.name).length <= 8, it.name)
})

test('순서 — 사진마다 6번 · 테두리 1번 · 같은 사진 연속 없음 · 처음 두 칸과 연속 칸에 테두리 없음 · 씨앗이 같으면 같다', () => {
  for (let s = 1; s <= 200; s++) {
    const seq = buildSequence(ALL, REPS, rngOf(s))
    assert.equal(seq.length, ITEMS * REPS)
    for (const i of ALL) {
      assert.equal(seq.filter((t) => t.item === i).length, REPS)
      assert.equal(seq.filter((t) => t.item === i && t.target).length, 1)
    }
    for (let k = 1; k < seq.length; k++) {
      assert.notEqual(seq[k].item, seq[k - 1].item, `seed ${s} k ${k}`)
      assert.ok(!(seq[k].target && seq[k - 1].target))
    }
    assert.ok(!seq[0].target && !seq[1].target)
    // 한 바퀴(5칸)에 다섯 장이 한 번씩
    for (let c = 0; c < REPS; c++) assert.equal(new Set(seq.slice(c * 5, c * 5 + 5).map((t) => t.item)).size, 5)
  }
  assert.deepEqual(buildSequence(ALL, REPS, rngOf(9)), buildSequence(ALL, REPS, rngOf(9)))
  // 둘 중 하나 — 두 장 x 4번 · 같은 사진 세 번 연속 없음
  for (let s = 1; s <= 200; s++) {
    const tb = buildSequence([3, 1], TB_REPS, rngOf(s))
    assert.equal(tb.length, 2 * TB_REPS)
    assert.equal(tb.filter((t) => t.target).length, 2)
    for (let k = 2; k < tb.length; k++) assert.ok(!(tb[k].item === tb[k - 1].item && tb[k].item === tb[k - 2].item))
  }
  // 단계 값 — 사진 7장 x 3번 · 셋 중 하나 · 사진 간격 범위
  for (let s = 1; s <= 100; s++) {
    const seven = buildSequence([0, 1, 2, 3, 4, 5, 6], 3, rngOf(s), [220, 380])
    assert.equal(seven.length, 21)
    assert.ok(seven.every((t) => t.isi >= 220 && t.isi <= 380))
    for (let k = 1; k < seven.length; k++) assert.notEqual(seven[k].item, seven[k - 1].item)
    const three = buildSequence([5, 2, 0], 5, rngOf(s))
    assert.equal(three.length, 15)
    assert.equal(three.filter((t) => t.target).length, 3)
  }
})

test('판정 — 숨긴 사진만 120ms 늦으면 그 사진이 1위 · 막대도 1위', () => {
  const r = rngOf(4)
  let ok = 0
  for (let s = 0; s < 40; s++) {
    const seq = buildSequence(ALL, REPS, r)
    const secret = s % 5
    const tr = fake(seq, (t) => 460 + jitter(r, 50) + (t.item === secret ? 120 : 0))
    const a = analyze(tr, ALL)
    const p = posterior([{ items: ALL, S: a.S, n: a.n }], ALL)
    ok += p.order[0] === secret
    const b = bars(a, ALL)
    assert.ok(b.every((x) => x.frac >= 0 && x.frac <= 1))
  }
  assert.ok(ok >= 38, `적중 ${ok}/40`)
})

test('판정 — 첫 노출 · 연습 효과(뒤로 갈수록 빨라짐) · 전환 늦음이 있어도 숨긴 사진을 찾는다', () => {
  const r = rngOf(5)
  let ok = 0
  for (let s = 0; s < 40; s++) {
    const seq = buildSequence(ALL, REPS, r)
    const secret = (s * 3) % 5
    const seen = new Set()
    let post = false
    const tr = fake(seq, (t, k) => {
      const first = !seen.has(t.item)
      seen.add(t.item)
      const rt = 620 - 8 * k + (first ? 150 : 0) + (post ? 90 : 0) + jitter(r, 40) + (t.item === secret ? 100 : 0)
      post = t.target
      return rt
    })
    const a = analyze(tr, ALL)
    ok += posterior([{ items: ALL, S: a.S, n: a.n }], ALL).order[0] === secret
  }
  assert.ok(ok >= 36, `적중 ${ok}/40`)
})

test('판정 — 이상치: 다른 사진 한 칸의 큰 멍때림 · 미리 누름 · 제한 시간 넘김에 흔들리지 않는다', () => {
  const r = rngOf(6)
  const seq = buildSequence(ALL, REPS, r)
  const secret = 2
  const other = seq.find((t, k) => k > 6 && t.item !== secret && !t.target)
  const early = seq.find((t, k) => k > 8 && t.item === secret && !t.target)
  const tr = fake(seq, (t) => {
    if (t === other) return null                   // 제한 시간 넘김(가장 늦음 값)
    if (t === early) return 90                     // 미리 누름 — 버린다
    return 450 + jitter(r, 30) + (t.item === secret ? 110 : 0)
  })
  const a = analyze(tr, ALL)
  assert.equal(posterior([{ items: ALL, S: a.S, n: a.n }], ALL).order[0], secret)
  assert.ok(a.dropped >= 1)
  // 다른 사진 한 칸에 1.5초짜리 값이 더 들어와도(제한 시간으로 잘림) 1위는 그대로
  const k2 = tr.findIndex((t, k) => k > 3 && t.item !== secret && t.item !== other.item && t.resp === 'no')
  const tr2 = tr.map((t, k) => (k === k2 ? { ...t, rt: 1500 } : t))
  const a2 = analyze(tr2, ALL)
  assert.equal(posterior([{ items: ALL, S: a2.S, n: a2.n }], ALL).order[0], secret)
  // 단계 제한 시간(950ms)도 같은 방식 — 넘긴 칸은 그 값으로 잘린다
  const a3 = analyze(tr2, ALL, { deadline: 950 })
  assert.equal(posterior([{ items: ALL, S: a3.S, n: a3.n }], ALL).order[0], secret)
})

test('판정 — 신호가 없으면 확신이 낮아 둘 중 하나로 간다 · 확률 합은 1 · 단계 값(횟수 · 기준 · 셋 중 하나)', () => {
  const r = rngOf(7)
  let low = 0
  for (let s = 0; s < 40; s++) {
    const tr = fake(buildSequence(ALL, REPS, r), () => 470 + jitter(r, 25))
    const a = analyze(tr, ALL)
    const p = posterior([{ items: ALL, S: a.S, n: a.n }], ALL)
    assert.ok(Math.abs(ALL.reduce((x, i) => x + p.p[i], 0) - 1) < 1e-9)
    if (p.conf < CONF_TB) low++
    const d = decide(p, false)
    if (p.conf < CONF_TB) { assert.equal(d.action, 'tiebreak'); assert.equal(d.pair.length, 2); assert.notEqual(d.pair[0], d.pair[1]) }
    assert.equal(decide(p, true).action, 'reveal')   // 기본은 둘 중 하나 한 번만
    // 단계 값 — 다시 보기 0번이면 바로 공개 · 두 번까지 · 셋 중 하나
    assert.equal(decide(p, 0, { tbMax: 0 }).action, 'reveal')
    if (p.conf < 0.7) {
      assert.equal(decide(p, 1, { tbMax: 2, confTb: 0.7 }).action, 'tiebreak')
      assert.equal(decide(p, 2, { tbMax: 2, confTb: 0.7 }).action, 'reveal')
      const t3 = decide(p, 0, { tbMax: 1, confTb: 0.7, tbK: 3 })
      assert.equal(t3.pair.length, 3)
      assert.equal(new Set(t3.pair).size, 3)
      assert.deepEqual(t3.pair, p.order.slice(0, 3))
    }
  }
  assert.ok(low >= 30, `낮은 확신 ${low}/40`)
  // 강한 신호면 확신이 높다
  const tr = fake(buildSequence(ALL, REPS, r), (t) => 450 + jitter(r, 20) + (t.item === 4 ? 160 : 0))
  const a = analyze(tr, ALL)
  const p = posterior([{ items: ALL, S: a.S, n: a.n }], ALL)
  assert.equal(p.order[0], 4)
  assert.ok(p.conf > 0.9, `확신 ${p.conf}`)
})

test('판정 — 둘 중 하나: 두 장 묶음이 나머지 가설을 건드리지 않고 순위를 바꾼다 · 여러 번 · 셋 중 하나도 합친다', () => {
  const r = rngOf(8)
  const main = fake(buildSequence(ALL, REPS, r), (t) => 470 + jitter(r, 25) + (t.item === 1 ? 40 : 0) + (t.item === 3 ? 40 : 0))
  const tb = fake(buildSequence([1, 3], TB_REPS, r), (t) => 470 + jitter(r, 15) + (t.item === 3 ? 150 : 0))
  const j = judgeRound(main, tb, ALL)
  assert.ok(j.tb)
  assert.equal(j.tbs, 1)
  assert.equal(j.next.action, 'reveal')
  assert.equal(j.next.guess, 3)
  // 묶음 배열로 넘겨도 같다
  const jl = judgeRound(main, [tb], ALL)
  assert.deepEqual(jl.post.p, j.post.p)
  // 두 번째 다시 보기(셋 중 하나) — 세 장 묶음까지 합쳐 1위가 3번으로 더 굳는다
  const tb2 = fake(buildSequence([3, 1, 0], 5, r), (t) => 470 + jitter(r, 15) + (t.item === 3 ? 140 : 0))
  const j2 = judgeRound(main, [tb, tb2], ALL, { tbMax: 3, confTb: 0.99 })
  assert.equal(j2.tbs, 2)
  assert.equal(j2.post.order[0], 3)
  assert.ok(j2.post.conf >= j.post.conf)
  // 사진 7장
  const seven = [0, 1, 2, 3, 4, 5, 6]
  const m7 = fake(buildSequence(seven, 6, r), (t) => 460 + jitter(r, 30) + (t.item === 6 ? 140 : 0))
  assert.equal(judgeRound(m7, null, seven).post.order[0], 6)
})

test('시뮬레이션 하한(옛 한 판 값) — 늦음 있는 사람 70% 이상 · 늦음 없는 사람은 우연(20%) 근처 · 일부러 늦춰도 55% 이상', () => {
  const N = 1200
  const tell = simulate('tell', N, 101)
  const none = simulate('none', N, 102)
  const slow = simulate('randomSlow', N, 103)
  const slowNone = simulate('randomSlowNone', N, 104)
  assert.ok(tell.hit >= 0.7, `tell ${tell.hit}`)
  assert.ok(none.hit >= 0.15 && none.hit <= 0.26, `none ${none.hit}`)
  assert.ok(slow.hit >= 0.55, `randomSlow ${slow.hit}`)
  assert.ok(slowNone.hit >= 0.14 && slowNone.hit <= 0.26, `randomSlowNone ${slowNone.hit}`)
  assert.ok(tell.hit >= tell.firstHit, '둘 중 하나가 적중을 깎지 않는다')
  assert.ok(tell.tbRate < none.tbRate, '신호가 없을수록 둘 중 하나가 잦다')
  // 한 판(세 라운드): 늦음 있는 사람은 거의 다 한 번 이상 들킨다
  const g = simulateGames('tell', 300, 105)
  assert.ok(g.atLeastOne >= 0.9, `한 번 이상 ${g.atLeastOne}`)
})

// 반응하는 가상 손 — 사진이 뜨면 rt 뒤에 누른다 (숨긴 사진은 더 늦게). 판 전체를 상태 기계로 돈다
function playRound(st, now, { secret, rtOf = () => 430, step = 10, answer = 'yes', real } = {}) {
  let s = st
  let t = now
  let due = null
  for (let guard = 0; guard < 40000 && (s.phase === 'run' || s.phase === 'tbIntro'); guard++) {
    t += step
    s = reduce(s, { type: 'tick', now: t })
    if (s.phase === 'run' && s.on && due == null) {
      const cur = s.seq[s.i]
      due = s.onset + rtOf(cur, secret)
      if (due === Infinity) due = null
    }
    if (s.phase === 'run' && s.on && due != null && t >= due) {
      s = reduce(s, { type: 'press', kind: expected(s.seq[s.i]), now: t })
      due = null
    }
    if (!s.on) due = null
  }
  assert.equal(s.phase, 'reveal')
  if (answer === 'yes') s = reduce(s, { type: 'yes' })
  else { s = reduce(s, { type: 'deny' }); assert.equal(s.phase, 'pick'); s = reduce(s, { type: 'pick', item: real }) }
  assert.equal(s.phase, 'done')
  return { s, t }
}

test('한 판(1단계) — 표지 · 다섯 장 3초 · 빠른 진행 · 공개 · 맞아요/아니 이거 · 세 라운드 · 결과 · 새 판', () => {
  let s = init(42)
  assert.equal(s.phase, 'cover')
  assert.equal(s.stage, 1)
  assert.deepEqual(s.rounds.map((r) => r.set), START_SETS)
  assert.ok(s.rounds.every((r) => r.items.length === 5 && new Set(r.items).size === 5 && r.items.every((i) => i >= 0 && i < SET_SIZE)))
  s = reduce(s, { type: 'start', now: 0 })
  assert.equal(s.phase, 'show')
  assert.equal(photosOf(s).length, 5)
  assert.equal(s.seq.length, 5 * STAGES[0].reps)
  assert.equal(reduce(s, { type: 'picked', now: SHOW_MS - 1 }).phase, 'show')   // 3초 전에는 못 넘어간다
  s = reduce(s, { type: 'picked', now: SHOW_MS })
  assert.equal(s.phase, 'run')
  assert.equal(reduce(s, { type: 'press', kind: 'no', now: SHOW_MS + 10 }).trials.length, 0)   // 사진 뜨기 전 누름은 무시
  // 라운드 1: 숨긴 사진(1번)에서 손이 200ms 늦다, 맞아요
  let r = playRound(s, SHOW_MS, { secret: 1, rtOf: (c, sec) => (c.item === sec ? 660 : 430) })
  s = r.s
  assert.equal(s.view.guess, 1)
  assert.equal(s.ai, 1); assert.equal(s.me, 0)
  assert.equal(s.trials.length, 0); assert.equal(s.mainTrials, null); assert.equal(s.tbList.length, 0)   // 원자료는 공개 때 버렸다
  assert.equal(s.results[0].hit, true)
  assert.equal(s.results[0].set, 'thing')
  assert.equal(s.results[0].item, s.rounds[0].items[1])
  s = reduce(s, { type: 'next', now: r.t + 100 })
  assert.equal(s.phase, 'show'); assert.equal(s.round, 1)
  s = reduce(s, { type: 'picked', now: r.t + 100 + SHOW_MS })
  // 라운드 2: 다른 사진(3번)에서 늦게 누르고 진짜는 0번이라고 한다, 숨김
  r = playRound(s, r.t + 100 + SHOW_MS, { secret: 3, rtOf: (c, sec) => (c.item === sec ? 670 : 430), answer: 'deny', real: 0 })
  s = r.s
  assert.equal(s.view.guess, 3)
  assert.equal(s.results[1].hit, false); assert.equal(s.results[1].real, 0)
  assert.equal(s.ai, 1); assert.equal(s.me, 1)
  // '아니, 이거'에서 AI 추측과 같은 걸 고르면 들킨 것 · 범위 밖 번호는 무시
  s = reduce(s, { type: 'next', now: r.t + 100 })
  s = reduce(s, { type: 'picked', now: r.t + 100 + SHOW_MS })
  r = playRound(s, r.t + 100 + SHOW_MS, { secret: 4, rtOf: (c, sec) => (c.item === sec ? 670 : 430), answer: 'deny', real: 4 })
  s = r.s
  assert.equal(s.results[2].hit, true)
  s = reduce(s, { type: 'next', now: r.t + 100 })
  assert.equal(s.phase, 'result')
  assert.equal(s.ai, 2); assert.equal(s.me, 1)
  assert.equal(s.won, false)                         // 세 판 중 한 번만 숨김 — 통과 못 함
  // 끝 화면에서 새 판(같은 단계 다시) — setup 이 있어야 한다
  assert.equal(reduce(s, { type: 'start', now: r.t + 200 }).phase, 'result')
  const again = reduce(s, { type: 'start', now: r.t + 200, setup: { seed: 7, stage: 1, best: 0, firstGame: false } })
  assert.equal(again.phase, 'show'); assert.equal(again.round, 0); assert.equal(again.ai, 0); assert.equal(again.results.length, 0); assert.equal(again.firstGame, false)
  // 사다리로 — 표지
  const back = reduce(s, { type: 'cover', setup: { seed: 8, stage: 2, best: 1 } })
  assert.equal(back.phase, 'cover'); assert.equal(back.stage, 2)
})

test('한 판(높은 단계) — 사진 7장 · 세 라운드 · 신호가 없으면 셋 중 하나를 여러 번까지 · 과반 숨기면 통과', () => {
  let s = init(77, { stage: 10, best: 9 })
  const cfg = STAGES[9]
  assert.equal(s.rounds.length, cfg.rounds)
  assert.equal(s.cfg.n, 7)
  assert.ok(s.rounds.every((r) => r.items.length === 7))
  assert.equal(new Set(s.rounds.map((r) => r.set)).size, cfg.rounds, '라운드마다 다른 세트')
  s = reduce(s, { type: 'start', now: 0 })
  assert.equal(s.seq.length, 7 * cfg.reps)
  let t = SHOW_MS
  for (let k = 0; k < cfg.rounds; k++) {
    s = reduce(s, { type: 'picked', now: t })
    let intros = 0
    let lastPhase = s.phase
    let due = null
    const r = rngOf(k + 1)
    for (let g = 0; g < 60000 && s.phase !== 'reveal'; g++) {
      t += 10
      s = reduce(s, { type: 'tick', now: t })
      if (s.phase === 'tbIntro' && lastPhase !== 'tbIntro') { intros++; assert.equal(s.pair.length, cfg.tbK) }
      lastPhase = s.phase
      if (s.phase === 'run' && s.on && due == null) due = s.onset + 440 + Math.round(r() * 6)
      if (s.phase === 'run' && s.on && t >= due) { s = reduce(s, { type: 'press', kind: expected(s.seq[s.i]), now: t }); due = null }
      if (!s.on) due = null
    }
    assert.equal(s.phase, 'reveal')
    assert.ok(intros >= 1 && intros <= cfg.tbMax, `다시 보기 ${intros}`)
    assert.equal(s.view.tb, intros)
    s = reduce(s, { type: 'deny' })
    s = reduce(s, { type: 'pick', item: 6 })
    assert.equal(s.phase, 'done')
    s = reduce(s, { type: 'next', now: t + 50 })
    t += 50 + SHOW_MS
  }
  assert.equal(s.phase, 'result')
  assert.equal(s.ai + s.me, cfg.rounds)
  assert.equal(s.won, s.me >= Math.floor(cfg.rounds / 2) + 1)
})

test('한 판 — 신호가 없으면 둘 중 하나(두 장) 뒤에 공개 · 안 누르면 제한 시간으로 넘어간다 · 다시 보기가 없는 단계는 바로 공개', () => {
  let s = reduce(init(3, { stage: 4, best: 3 }), { type: 'start', now: 0 })
  s = reduce(s, { type: 'picked', now: SHOW_MS })
  let sawIntro = false
  let t = SHOW_MS
  let due = null
  const r = rngOf(1)
  for (let g = 0; g < 20000 && s.phase !== 'reveal'; g++) {
    t += 10
    const before = s.phase
    s = reduce(s, { type: 'tick', now: t })
    if (s.phase === 'tbIntro') {
      sawIntro = true
      assert.equal(s.pair.length, 2)
      assert.equal(reduce(s, { type: 'tick', now: s.tbAt + TB_INTRO_MS - 1 }).phase, 'tbIntro')
    }
    if (before === 'tbIntro' && s.phase === 'run') { assert.equal(s.block, 'tb'); assert.equal(s.seq.length, 2 * STAGES[3].tbReps) }
    if (s.phase === 'run' && s.on && due == null) due = s.onset + 440 + Math.round(r() * 6)
    if (s.phase === 'run' && s.on && t >= due) { s = reduce(s, { type: 'press', kind: expected(s.seq[s.i]), now: t }); due = null }
  }
  assert.ok(sawIntro, '둘 중 하나를 거쳤다')
  assert.equal(s.view.tb, 1)
  // 1단계(다시 보기 없음) — 신호가 없어도 바로 공개
  let o = reduce(init(3), { type: 'start', now: 0 })
  o = reduce(o, { type: 'picked', now: SHOW_MS })
  t = SHOW_MS
  due = null
  for (let g = 0; g < 20000 && o.phase !== 'reveal'; g++) {
    t += 10
    o = reduce(o, { type: 'tick', now: t })
    assert.notEqual(o.phase, 'tbIntro')
    if (o.phase === 'run' && o.on && due == null) due = o.onset + 440
    if (o.phase === 'run' && o.on && t >= due) { o = reduce(o, { type: 'press', kind: expected(o.seq[o.i]), now: t }); due = null }
  }
  assert.equal(o.view.tb, 0)
  // 제한 시간 — 단계마다 다르다(10단계 950ms)
  for (const [opt, dl] of [[{}, STAGES[0].deadline], [{ stage: 10, best: 9 }, STAGES[9].deadline]]) {
    let q = reduce(reduce(init(5, opt), { type: 'start', now: 0 }), { type: 'picked', now: SHOW_MS })
    q = reduce(q, { type: 'tick', now: SHOW_MS + LEAD_IN })
    assert.equal(q.on, true)
    assert.equal(reduce(q, { type: 'tick', now: q.onset + dl - 1 }).on, true)
    q = reduce(q, { type: 'tick', now: q.onset + dl })
    assert.equal(q.on, false)
    assert.deepEqual(q.trials[0], { item: q.trials[0].item, target: q.trials[0].target, resp: null, rt: null })
    assert.equal(q.slip.kind, 'late')
  }
  assert.equal(STAGES[0].deadline, DEADLINE)
  // 잘못 누름 — 테두리 없는 사진에 '예'
  let w = reduce(reduce(init(5), { type: 'start', now: 0 }), { type: 'picked', now: SHOW_MS })
  w = reduce(w, { type: 'tick', now: SHOW_MS + LEAD_IN })
  w = reduce(w, { type: 'press', kind: 'yes', now: w.onset + 400 })
  assert.equal(w.slip.kind, 'wrong')
  assert.equal(w.trials[0].rt, 400)
  // 범위 밖 사진 번호는 무시 (5장 단계에서 6번)
  assert.equal(reduce({ ...w, phase: 'pick' }, { type: 'pick', item: 5 }).phase, 'pick')
})

test('깜빡임 — 가장 빠른 단계에서 가장 빨리 눌러도 사진이 바뀌는 간격은 0.6초 이상(1초에 3번 이하)', () => {
  for (const opt of [{}, { stage: 6, best: 5 }, { stage: 10, best: 9 }]) {
    let s = reduce(reduce(init(11, opt), { type: 'start', now: 0 }), { type: 'picked', now: SHOW_MS })
    const onsets = []
    let t = SHOW_MS
    for (let g = 0; g < 20000 && s.phase === 'run'; g++) {
      t += 4
      s = reduce(s, { type: 'tick', now: t })
      if (s.on && onsets[onsets.length - 1] !== s.onset) onsets.push(s.onset)
      if (s.on && t - s.onset >= 150) s = reduce(s, { type: 'press', kind: expected(s.seq[s.i]), now: t })
    }
    assert.ok(onsets.length >= s.cfg.n * s.cfg.reps)
    for (let k = 1; k < onsets.length; k++) assert.ok(onsets[k] - onsets[k - 1] >= MIN_SOA, `간격 ${onsets[k] - onsets[k - 1]}`)
    for (let k = 3; k < onsets.length; k++) assert.ok(onsets[k] - onsets[k - 3] > 1000, '1초 안에 사진 바뀜 3번 초과')
  }
  // 한 라운드 빠른 진행 길이 — 가장 긴 단계도 1분 안
  for (const c of STAGES) {
    const avg = 470 + (c.isi[0] + c.isi[1]) / 2
    assert.ok((c.n * c.reps * avg) / 1000 <= 45, `${c.stage}단계 ${(c.n * c.reps * avg) / 1000}초`)
  }
  assert.ok(END_PAUSE < 1000)
})

test('끝 화면 · 공유 · 해설 한 줄(mock) — 숫자 요약만 넘기고 짧다', async () => {
  assert.equal(shareText({ ai: 2, me: 1, daily: true }), '오늘의 판 AI 2 : 나 1. 너는 숨길 수 있어?')
  assert.equal(shareText({ ai: 1, me: 2, stage: 3, aiName: '관찰자', won: true }), "AI 3단계 '관찰자'를 속였다 (AI 1 : 나 2). 너는 몇 단계까지?")
  assert.equal(shareText({ ai: 1, me: 2, stage: 1, aiName: '견습생', won: true }), "AI 1단계 '견습생'을 속였다 (AI 1 : 나 2). 너는 몇 단계까지?")
  assert.equal(shareText({ ai: 2, me: 1, stage: 3, aiName: '관찰자' }), "AI 3단계 '관찰자'에게 들켰다 (AI 2 : 나 1). 너는 숨길 수 있어?")
  assert.equal(secText(140), '+0.14초')
  assert.equal(secText(0), '')
  assert.equal(secText(-30), '')
  assert.equal(loseLine([{ hit: true, ms: 120 }, { hit: false, ms: 400 }, { hit: true, ms: 310 }]), 'AI가 손이 늦어진 0.31초를 읽었어요.\n한 번 더?')
  assert.equal(loseLine([{ hit: true, ms: 0 }]), 'AI가 손의 망설임을 읽었어요.\n한 번 더?')
  for (const l of [loseLine([{ hit: true, ms: 999 }]), loseLine([])]) assert.ok(l.split('\n').every((x) => x.length <= 24), l)
  const results = [{ hit: true, rank: 0, ms: 120 }, { hit: false, rank: 1, ms: 40 }, { hit: false, rank: 3, ms: 0 }]
  const input = closingInput(results)
  assert.deepEqual(Object.keys(input).sort(), ['ai', 'rounds'])
  assert.deepEqual(Object.keys(input.rounds[0]).sort(), ['hit', 'lateMs', 'rank'])
  for (let ai = 0; ai <= 3; ai++) for (const rank of [1, 2, 3]) {
    const rs = [0, 1, 2].map((k) => ({ hit: k < ai, rank, lateMs: 0 }))
    const l = mockLine({ ai, rounds: rs })
    assert.ok(l.length > 5 && l.length <= 30, l)
    assert.ok(!/거짓말|탐지|진단|확실/.test(l), l)
  }
  assert.equal(mockLine({ ai: 3, rounds: [{}, {}, {}] }), '세 번 다, 아니라고 할 때 손이 먼저 멈칫했어요.')
  assert.equal(mockLine({ ai: 5, rounds: [{}, {}, {}, {}, {}] }), '다섯 번 다, 아니라고 할 때 손이 먼저 멈칫했어요.')
  assert.equal(await closingLine(results), mockLine(input))
  assert.equal(await closingLine(results, async () => '손이 먼저 알았어요.'), '손이 먼저 알았어요.')
  assert.equal(await closingLine(results, async () => { throw new Error('x') }), mockLine(input))
  let seen = ''
  await closingLine(results, async (p) => { seen = p; return '' })
  assert.ok(!/"rt"|trials/.test(seen))
})

test('원자료 비전송 — 숨긴 사진 폴더에는 네트워크 호출이 없고, 저장은 음악 켜짐 · 단계 기록 둘뿐', () => {
  for (const f of readdirSync(DIR).filter((x) => /\.(jsx?)$/.test(x))) {
    const src = readFileSync(new URL(f, DIR), 'utf8')
    assert.ok(!/\bfetch\s*\(|sendBeacon|XMLHttpRequest|WebSocket|EventSource/.test(src), f)
    const sets = src.match(/\.setItem\([^)]*\)/g) || []
    for (const s of sets) assert.match(s, /MUSIC_KEY|PROG_KEY|HABIT_KEY/, `${f}: ${s}`)
  }
  assert.equal(PROG_KEY, 'knows.v3')
  const proto = readFileSync(new URL('Proto.jsx', DIR), 'utf8')
  for (const ev of ['open', 'start', 'clear']) assert.ok(proto.includes(`track('knows', '${ev}')`), ev)   // 공용 약속(platform) — 2026-11-26
  assert.ok(proto.includes("const MUSIC_KEY = 'knows.mus'"))   // 게임 id 로 묶음 (2026-11-26)
  assert.ok(proto.includes('재미를 위한 놀이 · 진단 아님'))
  assert.ok(!/거짓말 탐지|탐지기/.test(proto))
  // 허브 EXP — 단계를 처음 깰 때만, 단계 · 판 id 가 들어간 키
  assert.ok(proto.includes("exp.add('knows', 'game_clear', `knows:clear:${st.stage}:${st.seed}`)"))
  assert.match(`knows:clear:${10}:${4294967295}`, /^[A-Za-z0-9._:@-]{8,120}$/)
})

test('숨긴 사진 소스에 이모지 · 금지 기호가 없다 (화면 · 코드 · 주석 모두 · 아이콘은 lucide-react 나 직접 그린 SVG)', () => {
  // 이모지 · 화살표(2190-21FF) · 도형(25A0-25FF) · 기타 기호와 딩뱃(2600-27BF: 별 · 하트 · 체크 · 손가락 등) · 별(2B50) · 이모지 꼴 바꿈(FE0F)
  const R = (a, b) => `${String.fromCodePoint(a)}-${String.fromCodePoint(b)}`
  const bad = new RegExp(`${String.fromCharCode(92)}p{Extended_Pictographic}|[${R(0x2190, 0x21ff)}${R(0x25a0, 0x25ff)}${R(0x2600, 0x27bf)}${String.fromCodePoint(0x2b50, 0xfe0f)}]`, 'u')
  const files = readdirSync(DIR).filter((x) => /\.(jsx?|css|md)$/.test(x))
  for (const f of ['Proto.jsx', 'engine.js', 'game.js', 'ladder.js', 'sets.js', 'sim.js']) assert.ok(files.includes(f), f)
  for (const f of files) {
    readFileSync(new URL(f, DIR), 'utf8').split('\n').forEach((l, i) => assert.ok(!bad.test(l), `${f}:${i + 1} ${l.trim()}`))
  }
  for (const t of readdirSync(new URL('./', import.meta.url)).filter((x) => /^v2-knows.*\.test\.mjs$/.test(x))) {
    readFileSync(new URL('./' + t, import.meta.url), 'utf8').split('\n').forEach((l, i) => assert.ok(!bad.test(l), `${t}:${i + 1}`))
  }
})
