// 「AI KNOWS YOU · 숨긴 사진」 엣지 — 아주 빠른 연타 · 안 누름 · 늘 '예' · 기계처럼 같은 시간 (11/25 전체 시험)
//   신호가 하나도 없을 때 AI 가 늘 같은 자리(1단계는 늘 첫 사진)를 골라, 그 자리만 피해 숨기면 이겼다
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MIN_RT, TIE_EPS, posterior, rngOf, tieRank } from '../src/games/v2/knows/engine.js'
import { init, reduce } from '../src/games/v2/knows/game.js'

// game.js 상태 기계로 한 라운드 — player(trial) => { kind: 'no'|'yes'|null, rt }
function playRound(seed, stage, player) {
  let st = reduce(init(seed, { stage, best: stage - 1, firstGame: false }), { type: 'start', now: 0 })
  let now = st.shownAt + 3100
  st = reduce(st, { type: 'picked', now })
  const slips = []
  for (let guard = 0; guard < 200000 && (st.phase === 'run' || st.phase === 'tbIntro'); guard++) {
    now += 16
    st = reduce(st, { type: 'tick', now })
    if (st.phase === 'run' && st.on) {
      const a = player(st.seq[st.i])
      if (a.kind) {
        const t = st.onset + a.rt
        while (now + 16 < t && st.on) { now += 16; st = reduce(st, { type: 'tick', now }) }
        if (st.on) {
          now = Math.max(now, t)
          const before = st.slip
          st = reduce(st, { type: 'press', kind: a.kind, now })
          if (st.slip !== before) slips.push(st.slip.kind)
        }
      }
    }
  }
  return { st, slips }
}

test('동점 순서 — tie 가 없으면 사진 번호 순(옛 동작 그대로), 있으면 그 순위 · 계산 찌꺼기 차이는 같음으로', () => {
  const all = [0, 1, 2, 3, 4]
  const flat = [{ items: all, S: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }, n: { 0: 4, 1: 4, 2: 4, 3: 4, 4: 4 } }]
  assert.deepEqual(posterior(flat, all).order, all)
  const tie = { 0: 3, 1: 4, 2: 0, 3: 2, 4: 1 }
  assert.deepEqual(posterior(flat, all, { tie }).order, [2, 4, 3, 0, 1])
  // 1e-15 만큼 다른 점수도 같은 것 — 첫째가 tie 로 정해진다
  const fuzz = [{ items: all, S: { 0: 1e-15, 1: 0, 2: -1e-15, 3: 0, 4: 0 }, n: flat[0].n }]
  assert.equal(posterior(fuzz, all, { tie }).order[0], 2)
  // 진짜 신호가 있으면 tie 는 아무것도 바꾸지 않는다
  const sig = [{ items: all, S: { 0: -0.2, 1: -0.2, 2: -0.2, 3: 0.8, 4: -0.2 }, n: flat[0].n }]
  assert.equal(posterior(sig, all, { tie }).order[0], 3)
  assert.equal(posterior(sig, all).order[0], 3)
  assert.ok(TIE_EPS > 0 && TIE_EPS < 1e-6)
  // tieRank — 순열(모든 사진이 한 번씩) · 같은 씨앗이면 같다
  const r = tieRank(all, rngOf(7))
  assert.deepEqual(Object.values(r).sort(), [0, 1, 2, 3, 4])
  assert.deepEqual(tieRank(all, rngOf(7)), r)
})

test('신호 없는 라운드 — 연타 · 안 누름 · 늘 예 · 늘 같은 시간에도 AI 가 늘 같은 자리를 고르지 않는다(판마다 섞임)', () => {
  const players = {
    mash: (tr) => ({ kind: 'no', rt: 60 + (tr.item * 7) % 50 }),                 // 사진을 보기 전에 연타(전부 0.15초 미만)
    never: () => ({ kind: null }),                                                // 안 누름(전부 제한 시간)
    yes: () => ({ kind: 'yes', rt: 450 }),                                        // 늘 '예'
    robot: (tr) => ({ kind: tr.target ? 'yes' : 'no', rt: 400 }),                 // 기계처럼 같은 시간
  }
  for (const stage of [1, 3, 8]) {
    for (const [name, pl] of Object.entries(players)) {
      const seen = {}
      const N = 40
      for (let s = 0; s < N; s++) {
        const { st } = playRound(1000 + s * 31, stage, pl)
        assert.equal(st.phase, 'reveal', `${name} ${stage}단계: ${st.phase}`)
        assert.ok(st.view.bars.every((b) => Number.isFinite(b.ms) && Number.isFinite(b.frac)), `${name} 막대 NaN`)
        seen[st.view.guess] = (seen[st.view.guess] || 0) + 1
      }
      const top = Math.max(...Object.values(seen))
      assert.ok(Object.keys(seen).length >= 3 && top <= N * 0.5, `${name} ${stage}단계 고른 자리 ${JSON.stringify(seen)}`)
    }
  }
})

test("너무 빠른 누름 — 사진이 뜨고 0.15초 안에 누르면 1초 가르침(early) · 점은 빨강 · 판정에서는 버려진다(옛 동작 그대로)", async () => {
  const { trialMark } = await import('../src/games/v2/knows/game.js')
  // 한 칸씩: 사진이 뜨면 rt 뒤에 누른다
  let st = reduce(init(4242, { stage: 1, best: 0, firstGame: false }), { type: 'start', now: 0 })
  let now = st.shownAt + 3100
  st = reduce(st, { type: 'picked', now })
  const pressAt = (kind, rt) => {
    while (!st.on) { now += 16; st = reduce(st, { type: 'tick', now }) }
    now = st.onset + rt
    st = reduce(st, { type: 'press', kind, now })
    return st.trials[st.trials.length - 1]
  }
  const want = () => (st.seq[st.i].target ? 'yes' : 'no')
  // 1) 맞는 버튼을 0.08초에 — early
  let k = want()
  let t = pressAt(k, 80)
  assert.equal(st.slip.kind, 'early')
  assert.equal(trialMark(t), 'x')
  // 2) 맞는 버튼을 0.45초에 — 가르침 없음(앞 slip 그대로) · 점은 청록
  const prev = st.slip
  k = want()
  t = pressAt(k, 450)
  assert.equal(st.slip, prev)
  assert.equal(trialMark(t), 'd')
  // 3) 틀린 버튼을 0.08초에 — 틀림이 먼저(테두리 가르침)
  k = want() === 'yes' ? 'no' : 'yes'
  t = pressAt(k, 80)
  assert.equal(st.slip.kind, 'wrong')
  assert.equal(trialMark(t), 'x')
  // 경계: 정확히 MIN_RT 는 판정에 쓰는 칸(analyze 는 rt >= MIN_RT 를 쓴다)
  k = want()
  t = pressAt(k, MIN_RT)
  assert.equal(st.slip.kind, 'wrong')
  assert.equal(trialMark(t), 'd')
  // 늦음(안 누름)은 점 빨강
  assert.equal(trialMark({ item: 0, target: false, resp: null, rt: null }), 'x')
  // 화면: early 가르침 한 줄 · 점 표시는 trialMark 하나로
  const { readFileSync } = await import('node:fs')
  const proto = readFileSync(new URL('../src/games/v2/knows/Proto.jsx', import.meta.url), 'utf8')
  assert.match(proto, /early: '사진 보고 누르기'/)
  assert.ok(proto.includes("st.slip.kind === 'late' || st.slip.kind === 'early' ? st.slip.kind"))
  assert.ok(proto.includes('const marks = st.trials.map(trialMark)'))
})

test('앱 전환(화면 숨김) — 떠 있던 칸은 판정에서 빠지고(away), 돌아오면 준비 시간 뒤 다음 사진 · 그 사진이 숨긴 사진으로 몰리지 않는다', async () => {
  const { LEAD_IN, analyze } = await import('../src/games/v2/knows/engine.js')
  // 상태 기계 — 사진이 떠 있을 때 숨김
  let st = reduce(init(77, { stage: 1, best: 0, firstGame: false }), { type: 'start', now: 0 })
  let now = st.shownAt + 3100
  st = reduce(st, { type: 'picked', now })
  while (!st.on) { now += 16; st = reduce(st, { type: 'tick', now }) }
  const i0 = st.i
  const slip0 = st.slip
  st = reduce(st, { type: 'away', now: now + 30 })
  const t = st.trials[st.trials.length - 1]
  assert.equal(t.away, true)
  assert.equal(st.on, false)
  assert.equal(st.i, i0 + 1)
  assert.equal(st.slip, slip0, '떠나 있던 칸에는 가르침(흔들림 · 소리)이 없다')
  // 5초 뒤 돌아옴 — 바로 사진이 뜨지 않고 준비 시간
  now += 5000
  st = reduce(st, { type: 'back', now })
  assert.ok(st.nextAt >= now + LEAD_IN - 1)
  st = reduce(st, { type: 'tick', now: now + 16 })
  assert.equal(st.on, false)
  // 사진 사이(안 떠 있을 때) 숨김 · 빠른 진행이 아닐 때는 아무것도 안 바뀐다
  const n0 = st.trials.length
  st = reduce(st, { type: 'away', now: now + 20 })
  assert.equal(st.trials.length, n0)
  const cover = init(5, { stage: 1 })
  assert.equal(reduce(cover, { type: 'away', now: 1 }), cover)
  assert.equal(reduce(cover, { type: 'back', now: 1 }), cover)

  // 판정 — 다른 사진(3번)에 떠 있던 칸 하나가 away 면 점수에 안 들어간다(옛날엔 제한 시간 값으로 들어가 3번이 숨긴 사진처럼 보였다)
  const seq = [0, 1, 2, 3, 4, 0, 1, 2, 3, 4].map((item) => ({ item, target: false }))
  const base = seq.map((s, k) => ({ ...s, resp: 'no', rt: 480 + (s.item === 1 ? 150 : 0) + (k % 3) * 10 }))
  const withAway = base.map((x, k) => (k === 8 ? { item: x.item, target: false, resp: null, rt: null, away: true } : x))
  const asLate = base.map((x, k) => (k === 8 ? { item: x.item, target: false, resp: null, rt: null } : x))
  const items = [0, 1, 2, 3, 4]
  const A = analyze(withAway, items)
  const L = analyze(asLate, items)
  assert.ok(A.S[1] > A.S[3], `away: 숨긴 1번 ${A.S[1].toFixed(2)} > 3번 ${A.S[3].toFixed(2)}`)
  assert.ok(L.S[3] > A.S[3], '늦음으로 넣으면 3번 점수가 올라간다(고친 이유)')
  assert.equal(A.n[3], 1)

  // 화면: visibilitychange 로 away · back, 음악 hold · resume
  const { readFileSync } = await import('node:fs')
  const proto = readFileSync(new URL('../src/games/v2/knows/Proto.jsx', import.meta.url), 'utf8')
  assert.ok(proto.includes("document.addEventListener('visibilitychange', onVis)"))
  assert.ok(proto.includes("if (document.hidden) { mus.hold(); dispatch({ type: 'away', now }) } else { mus.resume(); dispatch({ type: 'back', now }) }"))
  assert.ok(proto.includes('return { on, play, toggle, hold, resume }'))
})

test("느린 망 — 이 라운드 사진 파일이 다 받아져야 [골랐어요] (색 · 도형은 건너뜀 · 실패도 끝으로 · 상한 있음)", async () => {
  const { LOAD_WAIT_MS, SHOW_MS, photosOf, photosReady } = await import('../src/games/v2/knows/game.js')
  // 가짜 이미지 — src 를 넣으면 나중에 onload/onerror 를 부를 수 있게 모아 둔다
  const made = []
  const make = () => { const im = { complete: false, naturalWidth: 0 }; made.push(im); return im }
  const items = [{ src: '/a.webp' }, { src: '/b.webp' }, { color: '#fff' }, { shape: 'star' }, { src: '/a.webp' }]
  let done = false
  const p = photosReady(items, make).then((r) => { done = true; return r })
  assert.equal(made.length, 2, '같은 파일은 한 번 · 색 · 도형은 안 받는다')
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(done, false, '아직 안 받아짐')
  made[0].onload()
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(done, false, '하나 남음')
  made[1].onerror()
  assert.deepEqual(await p, [true, false])
  // 이미 받아 둔(캐시) 사진은 바로 끝
  const cached = () => ({ complete: true, naturalWidth: 10 })
  assert.deepEqual(await photosReady([{ src: '/c.webp' }], cached), [true])
  // 사진 파일이 없는 라운드(색 · 도형)는 바로 끝 · 빈 값도 안전
  assert.deepEqual(await photosReady([{ color: '#000' }], make), [])
  assert.deepEqual(await photosReady(null, make), [])
  // 만들기에서 터져도 기다림이 끝난다
  assert.deepEqual(await photosReady([{ src: '/d.webp' }], () => { throw new Error('x') }), [false])
  // 실제 라운드 사진(1단계 첫 라운드 = 물건 세트)은 파일이 있다
  const st = reduce(init(3, { stage: 1, best: 0 }), { type: 'start', now: 0 })
  assert.ok(photosOf(st).every((it) => it.src))
  assert.ok(SHOW_MS === 3000 && LOAD_WAIT_MS >= 3000 && LOAD_WAIT_MS <= 10000)
  // 화면: 3초 · 받아짐 둘 다 돼야 켠다 · 상한 타이머
  const { readFileSync } = await import('node:fs')
  const proto = readFileSync(new URL('../src/games/v2/knows/Proto.jsx', import.meta.url), 'utf8')
  assert.ok(proto.includes('const go = () => { if (alive && timeUp && loaded) setReady(true) }'))
  assert.ok(proto.includes('photosReady(photosOf(st)).then(() => { loaded = true; go() })'))
  assert.ok(proto.includes('setTimeout(() => { loaded = true; go() }, SHOW_MS + LOAD_WAIT_MS)'))
})

test('정직한 사람의 판정은 그대로 — 숨긴 사진에서만 늦으면 그 사진(동점 순서와 무관)', () => {
  for (const stage of [1, 5]) {
    let hit = 0
    const N = 30
    for (let s = 0; s < N; s++) {
      const r = rngOf(99 + s)
      const chosen = s % 5
      const { st } = playRound(500 + s, stage, (tr) => ({ kind: tr.target ? 'yes' : 'no', rt: 470 + (tr.item === chosen ? 160 : 0) + (r() - 0.5) * 120 }))
      if (st.view.guess === chosen) hit++
    }
    assert.ok(hit >= N * 0.8, `${stage}단계 적중 ${hit}/${N}`)
  }
  assert.equal(MIN_RT, 150)
})
