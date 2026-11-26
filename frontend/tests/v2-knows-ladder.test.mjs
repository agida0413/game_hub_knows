// 「AI KNOWS YOU · 숨긴 사진」 AI 단계 사다리 — 단계 값 · 진행 · 해금 · 기록 저장 · 오늘의 판 · 단계별 시뮬레이션 적중률
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MIN_SOA, rngOf } from '../src/games/v2/knows/engine.js'
import { START_SETS, planGame } from '../src/games/v2/knows/game.js'
import {
  DAILY, MAX_STAGE, PROG_KEY, SPEEDS, STAGES, applyGame, cleanProg, currentStage, dailyOf, freshProg, kstDate, loadProg, needOf, openSets,
  saveProg, setUnlockedBy, stageCfg, titleOf, wonGame,
} from '../src/games/v2/knows/ladder.js'
import { SETS, SET_SIZE } from '../src/games/v2/knows/sets.js'
import { simulate, simulateGames, simulateLadder } from '../src/games/v2/knows/sim.js'

// 기기 저장소 흉내 — 실패하는 저장소도
function memStore(init = {}) {
  const m = new Map(Object.entries(init))
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)) }, removeItem: (k) => m.delete(k), m }
}
const brokenStore = { getItem: () => { throw new Error('막힘') }, setItem: () => { throw new Error('막힘') } }

test('단계 값 — 10단계 · 이름 겹침 없음 · 단계가 오를수록 AI 가 세진다(사진 · 반복 · 다시 보기 · 라운드 · 빠르기)', () => {
  assert.equal(STAGES.length, MAX_STAGE)
  assert.deepEqual(STAGES.map((s) => s.stage), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.deepEqual(STAGES.map((s) => s.ai), ['견습생', '눈치꾼', '관찰자', '추적자', '분석가', '탐정', '심리술사', '마술사', '예언자', '독심술사'])
  assert.equal(new Set(STAGES.map((s) => s.ai)).size, MAX_STAGE)
  for (const s of STAGES) {
    assert.ok(s.ai.length >= 2 && s.ai.length <= 5, s.ai)
    assert.ok(s.n >= 5 && s.n <= SET_SIZE)
    assert.ok(s.reps >= 3 && s.reps <= 8)
    assert.ok(s.tbK === 2 || s.tbK === 3)
    assert.ok(s.rounds % 2 === 1, '라운드는 홀수(비김 없음)')
    assert.equal(s.minSoa, MIN_SOA)
    assert.ok(s.isi[0] < s.isi[1] && s.isi[0] >= 200)
    assert.deepEqual({ isi: s.isi, deadline: s.deadline }, { isi: SPEEDS[s.speed - 1].isi, deadline: SPEEDS[s.speed - 1].deadline })
    assert.ok(Object.isFrozen(s))
  }
  const up = (key) => STAGES.every((s, i) => i === 0 || s[key] >= STAGES[i - 1][key])
  // 다시 보기(tbMax)는 반복(reps)과 서로 바꿔 쓴다(3단계는 다시 보기 대신 반복) — 세기는 아래 시뮬레이션 테스트가 본다
  for (const k of ['n', 'reps', 'tbK', 'rounds', 'speed']) assert.ok(up(k), `${k} 는 줄지 않는다`)
  assert.ok(STAGES.every((s, i) => i < 3 || (s.tbMax >= STAGES[i - 1].tbMax && s.confTb >= STAGES[i - 1].confTb)), '4단계부터 다시 보기는 줄지 않는다')
  assert.ok(STAGES.every((s) => s.n * s.reps >= 15), '사진마다 테두리 말고 두 번 이상')
  assert.ok(STAGES.every((s, i) => i === 0 || s.deadline <= STAGES[i - 1].deadline), '제한 시간은 늘지 않는다')
  assert.deepEqual([STAGES[0].n, STAGES[9].n], [5, 7])
  assert.deepEqual([...new Set(STAGES.map((s) => s.n))], [5, 6, 7])
  assert.deepEqual([STAGES[0].rounds, STAGES[9].rounds], [3, 3])
  assert.equal(STAGES[0].tbMax, 0)
  assert.ok(STAGES[9].tbMax >= 2 && STAGES[9].tbK === 3)
  // 이기는 조건 — 과반
  assert.deepEqual([3, 5].map(needOf), [2, 3])
  assert.equal(wonGame(3, 2), true); assert.equal(wonGame(3, 1), false); assert.equal(wonGame(5, 3), true); assert.equal(wonGame(5, 2), false)
  // 범위 밖 단계는 가장 가까운 단계
  assert.equal(stageCfg(0).stage, 1); assert.equal(stageCfg(99).stage, 10); assert.equal(stageCfg('x').stage, 1)
  // 오늘의 판 — 3단계 값 · 세 라운드
  assert.equal(DAILY.n, STAGES[2].n); assert.equal(DAILY.reps, STAGES[2].reps); assert.equal(DAILY.rounds, 3); assert.equal(DAILY.stage, 0)
})

test('진행 · 해금 — 이기면 다음 단계와 새 세트 · 지면 같은 단계 · 연승 · 칭호 · 10단계 뒤에는 10단계 다시', () => {
  let p = freshProg()
  assert.equal(currentStage(p), 1)
  assert.equal(titleOf(p.best), '도전자')
  assert.deepEqual(openSets(p.best).map((s) => s.id), START_SETS)
  // 1단계 짐
  let r = applyGame(p, { stage: 1, rounds: 3, ai: 2, me: 1 })
  assert.deepEqual([r.won, r.firstClear, r.unlocked, r.next], [false, false, null, 1])
  p = r.prog
  assert.deepEqual([p.best, p.streak, p.plays, p.wins], [0, 0, 1, 0])
  // 1단계 깸 — 음식 세트가 열린다
  r = applyGame(p, { stage: 1, rounds: 3, ai: 1, me: 2 })
  assert.equal(r.won, true); assert.equal(r.firstClear, true); assert.equal(r.unlocked.id, 'food'); assert.equal(r.next, 2)
  p = r.prog
  assert.deepEqual([p.best, p.streak, p.bestStreak, p.plays, p.wins], [1, 1, 1, 2, 1])
  assert.equal(titleOf(p.best), '시치미')
  assert.deepEqual(openSets(p.best).map((s) => s.id), [...START_SETS, 'food'])
  // 2단계 깸(3:0) — 옆자리 · 연승 2
  r = applyGame(p, { stage: 2, rounds: 3, ai: 0, me: 3 })
  assert.equal(r.unlocked.id, 'seat')
  p = r.prog
  assert.deepEqual([p.best, p.streak, p.bestStreak], [2, 2, 2])
  // 3단계 짐 — 연승 끊김 · 최고 연승은 남는다
  r = applyGame(p, { stage: 3, rounds: 3, ai: 2, me: 1 })
  p = r.prog
  assert.deepEqual([p.best, p.streak, p.bestStreak, r.next], [2, 0, 2, 3])
  // 단계마다 하나씩 — 1~8단계가 세트 여덟 개를 연다 · 9 · 10단계는 칭호만
  const order = []
  let q = freshProg()
  for (let s = 1; s <= MAX_STAGE; s++) {
    const rounds = STAGES[s - 1].rounds
    const x = applyGame(q, { stage: s, rounds, ai: 0, me: rounds })
    order.push(x.unlocked ? x.unlocked.id : null)
    q = x.prog
    assert.equal(q.best, s)
    assert.equal(x.next, Math.min(MAX_STAGE, s + 1))
  }
  assert.deepEqual(order, ['food', 'seat', 'trip', 'party', 'desk', 'home', 'nature', 'shape', null, null])
  assert.equal(openSets(q.best).length, SETS.length)
  assert.equal(titleOf(q.best), '전설의 포커페이스')
  assert.equal(q.streak, MAX_STAGE)
  // 10단계 다시 이겨도 처음 깬 것이 아니다(EXP 한 번만)
  const again = applyGame(q, { stage: 10, rounds: 5, ai: 2, me: 3 })
  assert.deepEqual([again.won, again.firstClear, again.unlocked, again.next], [true, false, null, 10])
  // 5판 3선승 — 2번 숨김은 통과 못 함
  assert.equal(applyGame(q, { stage: 10, rounds: 5, ai: 3, me: 2 }).won, false)
  // 단계별 세트 해금 표
  assert.deepEqual(STAGES.map((s) => setUnlockedBy(s.stage)?.name ?? null), ['음식', '옆자리', '여행', '기념일', '책상', '집 안', '자연', '도형', null, null])
  assert.deepEqual([0, 1, 3, 5, 7, 9, 10].map(titleOf), ['도전자', '시치미', '능청꾼', '무표정', '포커페이스', '철가면', '전설의 포커페이스'])
})

test('기록 저장 — 새 키(knows.v3) · 숫자 요약만 · 깨진 값은 0 · 저장소가 막혀도 게임은 돈다', () => {
  assert.equal(PROG_KEY, 'knows.v3')
  const st = memStore()
  assert.deepEqual(loadProg(st), freshProg())
  const p = applyGame(freshProg(), { stage: 1, rounds: 3, ai: 1, me: 2 }).prog
  assert.equal(saveProg(st, p), true)
  const raw = JSON.parse(st.getItem(PROG_KEY))
  assert.deepEqual(Object.keys(raw).sort(), ['best', 'bestStreak', 'daily', 'plays', 'streak', 'v', 'wins'])
  assert.ok(!/rt|trial|ms/i.test(st.getItem(PROG_KEY)), '반응 시간 · 원자료 없음')
  assert.deepEqual(loadProg(st), p)
  // 깨진 · 조작된 값
  assert.deepEqual(loadProg(memStore({ [PROG_KEY]: '{깨짐' })), freshProg())
  assert.deepEqual(loadProg(memStore({ [PROG_KEY]: 'null' })), freshProg())
  const bad = loadProg(memStore({ [PROG_KEY]: JSON.stringify({ best: 99, streak: -3, bestStreak: 'x', plays: 2, wins: 7, daily: { date: '어제', ai: 1, me: 1 } }) }))
  assert.deepEqual(bad, { ...freshProg(), plays: 2, wins: 2 })
  assert.equal(cleanProg({ best: 4.5 }).best, 0)
  assert.equal(cleanProg({ best: 10 }).best, 10)
  // 막힌 저장소 · 없는 저장소
  assert.deepEqual(loadProg(brokenStore), freshProg())
  assert.equal(saveProg(brokenStore, p), false)
  assert.deepEqual(loadProg(null), freshProg())
  assert.equal(saveProg(null, p), false)
})

test('한 판 설계 — 첫 단계는 물건 · 장소 · 색, 그 뒤는 새로 열린 세트가 첫 라운드 · 열린 세트만 · 겹침 없음 · 씨앗이 같으면 같다', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const a = planGame({ seed, stage: 1, best: 0 })
    assert.deepEqual(a.rounds.map((r) => r.set), START_SETS)
    for (let best = 1; best <= MAX_STAGE; best++) {
      const stage = Math.min(MAX_STAGE, best + 1)
      const g = planGame({ seed, stage, best })
      const cfg = STAGES[stage - 1]
      assert.equal(g.rounds.length, cfg.rounds)
      assert.equal(g.cfg, cfg)
      const open = new Set(openSets(best).map((s) => s.id))
      assert.ok(g.rounds.every((r) => open.has(r.set)), '열린 세트만')
      assert.equal(new Set(g.rounds.map((r) => r.set)).size, cfg.rounds, '라운드마다 다른 세트')
      const fresh = setUnlockedBy(best)
      if (fresh) assert.equal(g.rounds[0].set, fresh.id, '새로 열린 세트가 첫 라운드')
      for (const r of g.rounds) {
        assert.equal(r.items.length, cfg.n)
        assert.equal(new Set(r.items).size, cfg.n)
        assert.ok(r.items.every((i) => Number.isInteger(i) && i >= 0 && i < SET_SIZE))
      }
    }
  }
  assert.deepEqual(planGame({ seed: 5, stage: 6, best: 5 }), planGame({ seed: 5, stage: 6, best: 5 }))
  assert.notDeepEqual(planGame({ seed: 5, stage: 6, best: 5 }).rounds, planGame({ seed: 6, stage: 6, best: 5 }).rounds)
})

test('오늘의 판 — 날짜 하나로 모두 같은 세트 · 같은 씨앗 · 같은 판 · 날마다 세트가 바뀐다 · 첫 기록만 남고 사다리는 그대로', () => {
  const d = dailyOf('2026-11-23')
  assert.deepEqual(dailyOf('2026-11-23'), d)
  assert.ok(Number.isInteger(d.seed) && d.seed >= 0)
  assert.ok(SETS.some((s) => s.id === d.set))
  // 열하루 동안 모든 세트가 한 번씩
  const days = Array.from({ length: SETS.length }, (_, i) => dailyOf(new Date(Date.UTC(2026, 10, 23 + i)).toISOString().slice(0, 10)).set)
  assert.equal(new Set(days).size, SETS.length)
  assert.notEqual(dailyOf('2026-11-24').seed, d.seed)
  const g = planGame({ seed: d.seed, daily: { set: d.set } })
  assert.deepEqual(planGame({ seed: d.seed, daily: { set: d.set } }), g)
  assert.equal(g.daily, true)
  assert.equal(g.stage, 0)
  assert.equal(g.rounds.length, 3)
  assert.ok(g.rounds.every((r) => r.set === d.set && r.items.length === DAILY.n))
  assert.ok(new Set(g.rounds.map((r) => r.items.join())).size >= 2, '라운드마다 다른 장들')
  // 기록 — 그날 첫 판만 · 사다리 · 연승은 그대로
  let p = { ...freshProg(), best: 3, streak: 2, bestStreak: 2 }
  let r = applyGame(p, { daily: true, date: '2026-11-23', rounds: 3, ai: 2, me: 1 })
  assert.deepEqual(r.prog.daily, { date: '2026-11-23', ai: 2, me: 1 })
  assert.deepEqual([r.prog.best, r.prog.streak, r.firstClear, r.unlocked], [3, 2, false, null])
  p = r.prog
  r = applyGame(p, { daily: true, date: '2026-11-23', rounds: 3, ai: 0, me: 3 })
  assert.deepEqual(r.prog.daily, { date: '2026-11-23', ai: 2, me: 1 }, '다시 해도 첫 기록')
  r = applyGame(r.prog, { daily: true, date: '2026-11-24', rounds: 3, ai: 1, me: 2 })
  assert.deepEqual(r.prog.daily, { date: '2026-11-24', ai: 1, me: 2 })
  // 한국 시간 날짜
  assert.equal(kstDate(Date.UTC(2026, 10, 23, 14, 59)), '2026-11-23')
  assert.equal(kstDate(Date.UTC(2026, 10, 23, 15, 0)), '2026-11-24')
})

// ---- 단계별 시뮬레이션 (숨김 지연이 있는 가상 사용자) ----
//   결정적(씨앗 고정) — 단계 값을 바꾸면 다시 재서 이 기준을 통과해야 한다. 큰 표는 reports 의 측정값(라운드 3000 · 판 1000)
test('시뮬레이션 — 단계가 오를수록 AI 적중률이 오른다(허용 오차 0.03) · 1단계는 AI 가 이기기 쉽지 않고 10단계는 매우 어렵다', () => {
  const rows = simulateLadder(STAGES, { kind: 'tell', rounds: 400, games: 0, seed: 3 })
  const hit = rows.map((r) => r.hit)
  for (let i = 1; i < hit.length; i++) assert.ok(hit[i] >= hit[i - 1] - 0.03, `${i}단계 ${hit[i - 1].toFixed(3)} -> ${i + 1}단계 ${hit[i].toFixed(3)}`)
  for (let i = 2; i < hit.length; i++) assert.ok(hit[i] > hit[i - 2], `두 단계 위는 확실히 더 세다 ${i + 1}`)
  assert.ok(hit[0] >= 0.45 && hit[0] <= 0.65, `1단계 라운드 적중 ${hit[0]}`)
  assert.ok(hit[9] >= 0.85, `10단계 라운드 적중 ${hit[9]}`)
  assert.ok(hit[9] - hit[0] >= 0.25)
  // 한 판 돌파율(내가 과반을 숨김) — 1단계는 꽤 자주, 10단계는 드물게
  const g1 = simulateGames('tell', 400, 31, STAGES[0])
  const g10 = simulateGames('tell', 250, 32, STAGES[9], { ds: [1] })
  assert.ok(g1.clear >= 0.35, `1단계 돌파 ${g1.clear}`)
  assert.ok(g10.clear <= 0.08, `10단계 돌파 ${g10.clear}`)
})

test('시뮬레이션 — 늦음이 없는 사람에게는 단계가 높아도 우연(1/사진 수) 근처 · 아는 척하지 않는다', () => {
  for (const s of [STAGES[0], STAGES[5], STAGES[9]]) {
    const z = simulate('none', 300, 40 + s.stage, s)
    const chance = 1 / s.n
    assert.ok(Math.abs(z.hit - chance) <= 0.07, `${s.stage}단계 none ${z.hit.toFixed(3)} (우연 ${chance.toFixed(3)})`)
  }
  // 같은 씨앗이면 같은 결과
  const a = simulate('tell', 50, 9, STAGES[3])
  const b = simulate('tell', 50, 9, STAGES[3])
  assert.deepEqual(a, b)
  assert.ok(rngOf(1)() !== rngOf(2)())
})
