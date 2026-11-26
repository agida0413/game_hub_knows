// 「숨긴 사진」 습관 이월 — 숫자 요약만 기기에 · 깨진 값은 처음 상태 · 이어받으면 신호가 있는 사람의 첫 라운드가 오른다
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HABIT_CAP, HABIT_OPT, LEARN_BASE, cleanHabit, habitCarry, habitChannels, habitInit, habitUpdate } from '../src/games/v2/knows/engine.js'
import { init } from '../src/games/v2/knows/game.js'
import { HABIT_KEY, loadHabit, saveHabit } from '../src/games/v2/knows/ladder.js'

const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)) }, m } }
const sigOf = (real, bump) => ({
  dw: { S: Object.fromEntries([0, 1, 2, 3, 4].map((i) => [i, i === real ? bump : -bump / 4])), n: { 0: 6, 1: 6, 2: 6, 3: 6, 4: 6 } },
})

test('이월 — 본 횟수는 cap 까지만 · 합은 같은 비율로 줄인다 · 원자료 필드 없음', () => {
  let h = habitInit()
  for (let k = 0; k < 6; k++) h = habitUpdate(h, sigOf(k % 5, 1), k % 5, [0, 1, 2, 3, 4])
  assert.equal(h.cnt.dw, 6)
  const c = habitCarry(h)
  assert.equal(c.cnt.dw, HABIT_CAP)
  assert.ok(Math.abs(c.sum.dw - h.sum.dw * HABIT_CAP / 6) < 1e-9)
  assert.deepEqual(Object.keys(c).sort(), ['cnt', 'k', 'sum'])
  assert.deepEqual(habitCarry(null), habitInit())
  assert.deepEqual(habitCarry(habitInit()), habitInit())
})

test('이월 저장 — 숫자 6개뿐 · 깨진 · 조작된 값은 처음 상태 · 막힌 저장소도 괜찮다', () => {
  assert.equal(HABIT_KEY, 'knows.h1')   // 게임 id 로 묶음 (2026-11-26, 옛 knw3.h1)
  const st = memStore()
  assert.deepEqual(loadHabit(st), habitInit())
  let h = habitInit()
  for (let k = 0; k < 4; k++) h = habitUpdate(h, sigOf(k, 0.9), k, [0, 1, 2, 3, 4])
  assert.equal(saveHabit(st, h), true)
  const raw = JSON.parse(st.getItem(HABIT_KEY))
  assert.deepEqual(Object.keys(raw).sort(), ['cnt', 'k', 'sum'])
  assert.ok(Object.values(raw.cnt).every((x) => x <= HABIT_CAP))
  assert.equal(loadHabit(st).cnt.dw, HABIT_CAP)
  for (const bad of ['{깨짐', 'null', '[]', JSON.stringify({ sum: { rt: 1e9, dw: 'x', off: 0 }, cnt: { rt: 99, dw: -1, off: 1.5 } })]) {
    const s = { getItem: () => bad }
    assert.deepEqual(loadHabit(s), habitInit(), bad)
  }
  assert.deepEqual(cleanHabit({ sum: { rt: 0, dw: 2, off: 0 }, cnt: { rt: 0, dw: 2, off: 0 } }).cnt, { rt: 0, dw: 2, off: 0 })
  assert.deepEqual(loadHabit({ getItem: () => { throw new Error('막힘') } }), habitInit())
  assert.equal(saveHabit({ setItem: () => { throw new Error('막힘') } }, h), false)
  assert.equal(saveHabit(null, h), false)
})

test('이월한 습관으로 첫 라운드부터 신호를 쓴다 · 처음 사람은 그대로 꺼져 있다 · init 이 받는다', () => {
  assert.equal(habitChannels(habitInit(), LEARN_BASE, HABIT_OPT).dw.d, 0)
  let h = habitInit()
  for (let k = 0; k < 3; k++) h = habitUpdate(h, sigOf(k, 0.9), k, [0, 1, 2, 3, 4])
  const carried = habitCarry(h)
  assert.ok(habitChannels(carried, LEARN_BASE, HABIT_OPT).dw.d > 0.25)
  assert.equal(habitChannels(carried, LEARN_BASE, HABIT_OPT).off.d, 0)
  assert.deepEqual(init(3, { stage: 2 }).habit, habitInit())
  assert.deepEqual(init(3, { stage: 2, habit: carried }).habit, carried)
})
