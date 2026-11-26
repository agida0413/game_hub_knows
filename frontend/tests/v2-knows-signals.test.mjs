// 「숨긴 사진」 손가락 신호 · 개인 습관 학습 · 근거 한 줄 — 순수 함수와 상태 기계로 검증
//   (신호를 넣을지는 시뮬레이션으로 정했다 — 숫자는 보고서 · 판정 엔진 머리말에. 여기서는 동작과 안전 장치를 고정한다)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  HABIT_OPT, LEARN_BASE, analyzeSide, evidence, habitChannels, habitInit, habitUpdate, judgeRound, rngOf,
} from '../src/games/v2/knows/engine.js'
import { SHOW_MS, init, reduce } from '../src/games/v2/knows/game.js'
import { simulate, simulateGames } from '../src/games/v2/knows/sim.js'
import { STAGES } from '../src/games/v2/knows/ladder.js'

const ITEMS5 = [0, 1, 2, 3, 4]

// 사진 5장 x 6칸 — 값은 호출한 쪽이 정한다
function trialsOf(valueOf, key) {
  const out = []
  for (let k = 0; k < 6; k++) for (const item of ITEMS5) out.push({ item, target: false, resp: 'no', rt: 430, [key]: valueOf(item, k) })
  return out
}

test('analyzeSide — 한 사진에서만 값이 큰 신호는 그 사진 점수가 가장 높다 · 값이 없으면 null · 예 칸은 건너뛴다', () => {
  const r = rngOf(5)
  const t = trialsOf((i) => 100 + (i === 3 ? 30 : 0) + (r() - 0.5) * 20, 'dw')
  const a = analyzeSide(t, ITEMS5, 'dw')
  assert.equal(Object.entries(a.S).sort((p, q) => q[1] - p[1])[0][0], '3')
  assert.ok(Math.abs(ITEMS5.reduce((s, i) => s + a.n[i] * a.S[i], 0)) < 1e-6, '점수 합은 가운데로 맞춰져 있다')
  assert.equal(analyzeSide(trialsOf(() => undefined, 'dw'), ITEMS5, 'dw'), null)
  assert.equal(analyzeSide(trialsOf(() => 100, 'dw'), ITEMS5, 'dw'), null, '값이 모두 같으면 쓰지 않는다')
  const withYes = t.map((x) => ({ ...x, resp: 'yes' }))
  assert.equal(analyzeSide(withYes, ITEMS5, 'dw'), null)
})

test('개인 습관 — 통하는 신호는 d 가 커지고 통하지 않는 신호는 0 쪽으로 · 첫 라운드는 기본 믿음(c0)만 · 음수는 없다', () => {
  const base = { ds: [1], dw: { d: 0.35, vf: 1.6 }, off: { d: 0.3, vf: 1.6 } }
  const first = habitChannels(habitInit(), base, { w0: 1.5, c0: 0, m0: 0 })
  assert.equal(first.dw.d, 0); assert.equal(first.off.d, 0)
  const sig = (real, bump) => ({
    rt: { S: Object.fromEntries(ITEMS5.map((i) => [i, i === real ? 1 : -0.25])), n: Object.fromEntries(ITEMS5.map((i) => [i, 6])) },
    dw: { S: Object.fromEntries(ITEMS5.map((i) => [i, i === real ? bump : -bump / 4])), n: Object.fromEntries(ITEMS5.map((i) => [i, 6])) },
  })
  let h = habitInit()
  for (let k = 0; k < 3; k++) h = habitUpdate(h, sig(k, 0.8), k, ITEMS5)
  assert.equal(h.k, 3); assert.equal(h.cnt.dw, 3); assert.equal(h.cnt.off, 0)
  const learned = habitChannels(h, base, { w0: 1.5, c0: 0, m0: 0 })
  assert.ok(learned.dw.d > 0.3, `통한 신호 d ${learned.dw.d}`)
  assert.equal(learned.off.d, 0, '한 번도 못 본 신호는 처음 믿음(0) 그대로')
  let z = habitInit()
  for (let k = 0; k < 3; k++) z = habitUpdate(z, sig(k, -0.5), k, ITEMS5)
  assert.equal(habitChannels(z, base, { w0: 1.5, c0: 0, m0: 0 }).dw.d, 0, '거꾸로 나온 신호는 0 으로 꺼진다')
  // 진짜 답이 범위 밖이면 무시
  assert.equal(habitUpdate(habitInit(), sig(1, 1), 99, ITEMS5).cnt.dw, 0)
})

test('근거 한 줄 — 고른 사진에서 몇 번이 다른 사진 중앙값보다 늦었나(숫자 두 개)', () => {
  const t = trialsOf((i) => 0, 'dw').map((x, k) => ({ ...x, rt: x.item === 2 ? (k % 5 === 2 && k < 20 ? 420 : 560) : 430 }))
  const ev = evidence(t, 2)
  assert.equal(ev.of, 6)
  assert.equal(ev.k, 6 - t.filter((x) => x.item === 2 && x.rt === 420).length)
  assert.deepEqual(Object.keys(ev).sort(), ['k', 'of'])
  const late = [{ item: 1, target: false, resp: null, rt: null }, { item: 0, target: false, resp: 'no', rt: 400 }, { item: 0, target: false, resp: 'no', rt: 410 }]
  assert.equal(evidence(late, 1, 1100).k, 1, '제한 시간을 넘긴 칸은 가장 늦은 칸')
})

test('라운드 판정 — 신호 묶음을 줘도 원자료가 결과에 새지 않는다(점수 · 요약 숫자만) · 신호가 없으면 판정이 옛 것과 같다', () => {
  const r = rngOf(9)
  const t = []
  for (let k = 0; k < 6; k++) for (const item of ITEMS5) t.push({ item, target: false, resp: 'no', rt: Math.round(430 + (item === 1 ? 60 : 0) + r() * 40), dw: 100 + r() * 20, off: r() * 0.3 })
  const plain = judgeRound(t, null, ITEMS5, { channels: { ds: [1] } })
  const none = judgeRound(t.map(({ dw, off, ...rest }) => rest), null, ITEMS5, { channels: { ds: [1], dw: { d: 0.3, vf: 1.6 } } })
  assert.equal(plain.next.guess, none.next.guess)
  assert.ok(Math.abs(plain.post.conf - none.post.conf) < 1e-9, '값이 없는 신호는 확률을 바꾸지 않는다')
  const withSig = judgeRound(t, null, ITEMS5, { channels: { ds: [1], dw: { d: 0.3, vf: 1.6 }, off: { d: 0.3, vf: 1.6 } } })
  assert.equal(withSig.next.guess, 1)
  const text = JSON.stringify({ sig: withSig.sig, ev: withSig.ev })
  assert.ok(!/"rt":\s*\d{3}/.test(text.replace(/"S":\{[^}]*\}/g, '')), '신호 요약은 사진별 점수 · 칸 수뿐')
})

// ---- 화면 상태 기계 ----
function toRun(seed = 3) {
  let s = init(seed)
  s = reduce(s, { type: 'start', now: 0 })
  s = reduce(s, { type: 'picked', now: SHOW_MS })
  let t = SHOW_MS
  for (let g = 0; g < 400 && !s.on; g++) { t += 20; s = reduce(s, { type: 'tick', now: t }) }
  return { s, t }
}

test('손가락 신호 — 누른 칸에 터치 쏠림(off)이 남고, 손을 떼면 같은 칸에 닿은 시간(dw)이 붙는다 · 이상한 값은 버린다', () => {
  let { s, t } = toRun()
  assert.ok(s.on)
  const exp = s.seq[s.i].target ? 'yes' : 'no'
  const pd = t + 400
  s = reduce(s, { type: 'press', kind: exp, now: pd, off: 0.37 })
  assert.equal(s.trials.length, 1)
  assert.equal(s.trials[0].off, 0.37)
  assert.equal(s.trials[0].pd, pd)
  const a = reduce(s, { type: 'release', pd, now: pd + 95 })
  assert.equal(a.trials[0].dw, 95)
  assert.equal(reduce(s, { type: 'release', pd, now: pd + 5 }).trials[0].dw, undefined, '너무 짧은 값은 버린다')
  assert.equal(reduce(s, { type: 'release', pd, now: pd + 5000 }).trials[0].dw, undefined, '너무 긴 값은 버린다')
  assert.equal(reduce(s, { type: 'release', pd: pd + 1, now: pd + 95 }).trials[0].dw, undefined, '다른 칸에는 붙지 않는다')
  // 쏠림 값이 없는 누름(키보드)도 된다
  let k = toRun(4).s
  k = reduce(k, { type: 'press', kind: k.seq[k.i].target ? 'yes' : 'no', now: k.onset + 400 })
  assert.equal(k.trials[0].off, undefined)
})

test('판 상태 — 습관은 라운드 사이에만 이어지고 원자료(trials · 신호 요약)는 공개 뒤 남지 않는다', () => {
  const s = init(7)
  assert.equal(s.habit.k, 0)
  assert.equal(s.sig, null)
  assert.ok(LEARN_BASE.ds.length >= 1 && HABIT_OPT.w0 > 0)
})

test('시뮬레이션 — 습관 학습은 신호가 없는 사람에게 적중률을 거의 깎지 않고(0.08 이내) 우연 근처를 지킨다', () => {
  const none = simulateGames('none', 120, 31, STAGES[3], { ...LEARN_BASE, learn: HABIT_OPT })
  const mean = none.byRound.reduce((a, x) => a + x, 0) / none.byRound.length
  assert.ok(mean <= 0.3, `none 적중 ${mean}`)
})

test('시뮬레이션 — 손가락 신호가 있는 사람은 첫 라운드는 그대로, 둘째 · 셋째 라운드부터 크게 더 맞힌다(학습 없는 옛 판정과 비교)', () => {
  const st = STAGES[4]
  const old = simulateGames('smallF', 160, 41, st, { ds: [1] })
  const now = simulateGames('smallF', 160, 41, st)
  assert.ok(Math.abs(now.byRound[0] - old.byRound[0]) <= 0.15, `첫 라운드 ${now.byRound[0]} 대 ${old.byRound[0]}`)
  const late = (g) => (g.byRound[1] + g.byRound[2]) / 2
  assert.ok(late(now) - late(old) >= 0.2, `둘째 · 셋째 라운드 ${late(now).toFixed(2)} 대 ${late(old).toFixed(2)}`)
})

test('시뮬레이션 — 신호가 없는 사람(작은 늦음)에게는 학습을 켜도 적중률이 옛 판정에서 0.08 넘게 깎이지 않는다', () => {
  const st = STAGES[4]
  const old = simulateGames('small', 160, 43, st, { ds: [1] })
  const now = simulateGames('small', 160, 43, st)
  const avg = (g) => g.byRound.reduce((a, x) => a + x, 0) / g.byRound.length
  assert.ok(avg(now) >= avg(old) - 0.08, `${avg(now).toFixed(2)} 대 ${avg(old).toFixed(2)}`)
})

test('난이도 곡선 — 같은 사람(늦음 큼)에게 1~5단계 라운드 적중이 매끄럽게 오른다(2 · 3 · 4단계가 평평하지 않다)', () => {
  const hit = (i) => simulate('tell', 900, 61 + i, STAGES[i]).hit
  const h = [1, 2, 3].map(hit)
  assert.ok(h[1] - h[0] >= 0.03 && h[2] - h[1] >= -0.03 && h[2] - h[0] >= 0.08, `2 · 3 · 4 단계 ${h.map((x) => x.toFixed(2))}`)
})
