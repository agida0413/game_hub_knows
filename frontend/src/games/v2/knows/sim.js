// 「숨긴 사진」 가상 사용자 — 판정 엔진 적중률을 미리 재는 시뮬레이션 (화면에서는 쓰지 않는다 · 테스트 전용)
//   반응 시간 모형: 개인 평균 + 시작 몸풀기(점점 빨라짐) + 첫 노출 + 전환 늦음('예' 칸 · 실수 다음) + 정규 흔들림 + 지수 꼬리
//                   + 가끔 멍때림 · 미리 누름 · 버튼 실수. 숨긴 사진의 '아니'에만 delta 만큼 늦어진다(칸마다 0.6~1.4배)
//   AI 단계(ladder.js)마다 같은 사람 모형으로 라운드 적중률 · 한 판 돌파율을 잰다 — 단계 표의 숫자는 여기서 나온다
//   2라운드(11/24) 새 방식 실험 — 같은 사람 모형으로 잰 값(인구 혼합 A: 없음 25 · 작은 늦음 35 · 큰 늦음 25 · 일부러 늦춤 10 · 작은 늦음+속임 5, 라운드 적중률)
//     적응형 질문(처음 3~4번 + 항상 위 두 장 몰아 보기): 같은 30칸에서 .456 -> .491(+.035, 표본 오차 약 .012). 칸 수를 늘리지 않고는 큰 이득 없음 -> 지금의 '헷갈릴 때만 다시 보기'를 유지
//     자기 보고 채널(확신 막대 · 둘 중 고르기, 숨긴 사진이 한 흔들림(g=1)만큼 낮게 나온다고 가정): 3단계 .416 -> g=.3 .427 · g=.6 .450 · g=1 .489. 실제 사람이 얼마나 새는지 모르고 속이기 쉬워 넣지 않음
//     습관 이월(판이 끝나도 신호 요약 숫자 6개를 기기에 남김): 손가락 신호가 있는 사람의 다음 판 첫 라운드 .36 -> .74~.87, 신호 없는 사람은 변화 없음(표본 오차 안)
import { CONF_TB, DEADLINE, HABIT_OPT, ISI_MAX, ISI_MIN, ITEMS, LEARN_BASE, REPS, TB_REPS, buildSequence, expected, habitChannels, habitInit, habitUpdate, judgeRound, rngOf } from './engine.js'

// 유형 — tell: 숨긴 사진에서 50~150ms 늦음 · none: 늦음 없음(우연 20% 근처여야 한다)
//        randomSlow: 늦음은 그대로 + 30% 칸에서 일부러 80~350ms 늦춤 · randomSlowNone: 늦음 없이 일부러 늦추기만
//        small: 실제 연구에서 흔한 작은 늦음(20~50ms) — 보고용
export const KINDS = {
  tell: { delta: [50, 150] },
  none: { delta: [0, 0] },
  randomSlow: { delta: [50, 150], slowP: 0.3, slow: [80, 350] },
  randomSlowNone: { delta: [0, 0], slowP: 0.3, slow: [80, 350] },
  small: { delta: [20, 50] },
  // 사람 모형 더하기 — 큰 늦음 · 작은 늦음 + 퍼짐(sd) · 손가락 신호(dw 닿은 시간 · off 터치 쏠림) · 속이는 사람
  big: { delta: [100, 250] },
  smallDeceive: { delta: [20, 50], slowP: 0.3, slow: [80, 350] },
  smallF: { delta: [20, 50], dwD: [8, 25], offD: [0.2, 0.5] },        // 늦음 작음 + 손가락(닿은 시간 · 쏠림)
  smallD: { delta: [20, 50], dwD: [8, 25] },                         // 늦음 작음 + 닿은 시간만
  smallO: { delta: [20, 50], offD: [0.2, 0.5] },                      // 늦음 작음 + 터치 쏠림만
  smallVF: { delta: [20, 50], dwD: [8, 25], offD: [0.2, 0.5] },
  noneF: { delta: [0, 0], dwD: [8, 25], offD: [0.2, 0.5] },           // 반응 시간엔 안 나오고 손가락에만 나옴
}

// 옛 한 판(단계 없음)의 값 — 단계 표가 없을 때의 기본
export const LEGACY = { n: ITEMS, reps: REPS, tbMax: 1, confTb: CONF_TB, tbReps: TB_REPS, tbK: 2, isi: [ISI_MIN, ISI_MAX], deadline: DEADLINE, rounds: 3 }

const U = (r, lo, hi) => lo + r() * (hi - lo)
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())

export function makeUser(r, kind) {
  const k = KINDS[kind]
  return {
    mu: U(r, 380, 520), sigma: U(r, 40, 65), tau: U(r, 40, 100), warm: U(r, 40, 120), first: U(r, 20, 60), sw: U(r, 30, 80),
    delta: U(r, k.delta[0], k.delta[1]), slowP: k.slowP || 0, slow: k.slow || [0, 0],
    sdMul: k.sdMul || 1, dwMu: U(r, 70, 130), dwSd: U(r, 18, 32), dwD: k.dwD ? U(r, k.dwD[0], k.dwD[1]) : 0,
    offSd: U(r, 0.18, 0.3), offD: k.offD ? U(r, k.offD[0], k.offD[1]) : 0, pace: !!k.pace,
    errP: 0.02, missP: 0.05, antP: 0.01, lapseP: 0.02, k: 0,
  }
}

// 한 칸 응답 — ctx: { first, post, probe } · deadline: 이 단계의 제한 시간(넘기면 안 누른 것)
export function respond(u, r, trial, ctx, deadline = DEADLINE) {
  const k = u.k++
  const sm = ctx.probe && !trial.target ? u.sdMul : 1
  let rt = u.mu + u.warm * Math.exp(-k / 5) + sm * (gauss(r) * u.sigma - u.tau * Math.log(1 - r()))
  if (ctx.first) rt += u.first
  if (ctx.post) rt += u.sw
  if (trial.target) rt += 60
  if (ctx.probe && !trial.target) rt += u.delta * U(r, 0.6, 1.4)
  if (u.slowP && r() < u.slowP) rt += U(r, u.slow[0], u.slow[1])
  if (r() < u.lapseP) rt += U(r, 250, 600)
  if (r() < u.antP) rt = U(r, 90, 170)
  let resp = expected(trial)
  if (trial.target ? r() < u.missP : r() < u.errP) resp = resp === 'yes' ? 'no' : 'yes'
  if (rt > deadline) return { ...trial, resp: null, rt: null }
  // 손가락 신호 — 닿은 시간(ms) · 버튼 가운데에서 벗어난 정도(0~1 · 크기만)
  const dw = Math.max(25, u.dwMu + gauss(r) * u.dwSd + (ctx.probe && !trial.target ? u.dwD : 0))
  const off = Math.abs(gauss(r)) * u.offSd + (ctx.probe && !trial.target ? u.offD * Math.abs(gauss(r)) * 0.6 : 0)
  return { ...trial, resp, rt: Math.round(rt), dw: Math.round(dw), off: Math.round(off * 1000) / 1000 }
}

function run(u, r, seq, secret, seen, deadline) {
  let post = false
  return seq.map((tr) => {
    const first = !seen.has(tr.item)
    seen.add(tr.item)
    const out = respond(u, r, tr, { first, post, probe: tr.item === secret }, deadline)
    post = tr.target || out.resp !== expected(tr)
    return out
  })
}

// 한 라운드 — 다시 보기(둘 중 하나 · 셋 중 하나)까지 엔진 그대로
//   opt.cfg: 단계 값(없으면 옛 한 판) · opt.priorScale: 앞 라운드 흔들림
export function playRound(r, u, opt = {}) {
  const c = { ...LEGACY, ...(opt.cfg || {}) }
  const items = Array.from({ length: c.n }, (_, i) => i)
  const secret = Math.floor(r() * c.n)
  const seen = new Set()
  const trials = run(u, r, buildSequence(items, c.reps, r, c.isi), secret, seen, c.deadline)
  const jopt = { ...(opt.channels ? { channels: opt.channels } : {}), deadline: c.deadline, tbMax: c.tbMax, confTb: c.confTb, tbK: c.tbK, ...(opt.priorScale ? { priorScale: opt.priorScale } : {}) }
  const j1 = judgeRound(trials, null, items, jopt)
  let j = j1
  const tbs = []
  while (j.next.action === 'tiebreak') {
    tbs.push(run(u, r, buildSequence(j.next.pair, c.tbReps, r, c.isi), secret, seen, c.deadline))
    j = judgeRound(trials, tbs, items, jopt)
  }
  const all = trials.length + tbs.reduce((a, b) => a + b.length, 0)
  const late = trials.filter((t) => t.resp === null).length + tbs.reduce((a, b) => a + b.filter((t) => t.resp === null).length, 0)
  return {
    secret, guess: j.next.guess, hit: j.next.guess === secret, tb: tbs.length > 0, tbs: tbs.length,
    firstHit: j1.post.order[0] === secret, conf: j.post.conf, scale: j.main.scale, sig: j1.sig, trials: all, late,
  }
}

// 여러 라운드 — 적중률 · 둘 중 하나 비율 · 확신 구간별 실제 적중(보정 확인)
export function simulate(kind, rounds, seed, cfg, channels) {
  const r = rngOf(seed)
  let hit = 0
  let firstHit = 0
  let tb = 0
  let conf = 0
  let trials = 0
  let late = 0
  const cal = [[0, 0], [0, 0], [0, 0], [0, 0]]   // 확신 <.4 · .4~.6 · .6~.8 · .8~
  for (let g = 0; g < rounds; g++) {
    const u = makeUser(r, kind)
    const o = playRound(r, u, { cfg, channels })
    hit += o.hit; firstHit += o.firstHit; tb += o.tb; conf += o.conf; trials += o.trials; late += o.late
    const b = o.conf < 0.4 ? 0 : o.conf < 0.6 ? 1 : o.conf < 0.8 ? 2 : 3
    cal[b][0]++; cal[b][1] += o.hit
  }
  return {
    kind, rounds, hit: hit / rounds, firstHit: firstHit / rounds, tbRate: tb / rounds, meanConf: conf / rounds,
    trials: trials / rounds, lateRate: late / Math.max(1, trials), cal: cal.map(([n, h]) => ({ n, rate: n ? h / n : 0 })),
  }
}

// 한 판(같은 사람 · 단계의 라운드 수) — AI 점수 분포 · 한 번 이상 들킬 확률 · 돌파율(내가 과반을 숨김)
//   앞 라운드 흔들림을 다음 라운드 기준으로 넘긴다(화면과 같다)
export const SHIPPED = { ...LEARN_BASE, learn: HABIT_OPT }   // 화면이 쓰는 신호 묶음(손가락 신호 + 개인 습관 학습)
export function simulateGames(kind, games, seed, cfg, channels = SHIPPED) {
  const c = { ...LEGACY, ...(cfg || {}) }
  const R = c.rounds
  const need = Math.floor(R / 2) + 1
  const r = rngOf(seed)
  const dist = new Array(R + 1).fill(0)
  const hitByRound = new Array(R).fill(0)
  let clear = 0
  for (let g = 0; g < games; g++) {
    const u = makeUser(r, kind)
    let ai = 0
    let prior
    let habit = channels && channels.learn ? habitInit() : null
    const items = Array.from({ length: c.n }, (_, i) => i)
    for (let k = 0; k < R; k++) {
      const ch = habit || (channels && channels.learn) ? habitChannels(habit, channels, channels.learn) : channels
      const o = playRound(r, u, { cfg: c, channels: ch, ...(prior ? { priorScale: prior } : {}) })
      ai += o.hit
      prior = o.scale
      if (habit) habit = habitUpdate(habit, o.sig, o.secret, items)
      if (hitByRound) hitByRound[k] += o.hit
    }
    dist[ai]++
    if (R - ai >= need) clear++
  }
  return {
    kind, games, rounds: R, byRound: hitByRound.map((x) => x / games), dist: dist.map((x) => x / games), atLeastOne: 1 - dist[0] / games,
    mean: dist.reduce((a, x, i) => a + x * i, 0) / games, clear: clear / games,
  }
}

// 단계 표 전체 — 단계마다 라운드 적중률 · 한 판 돌파율 · 라운드 칸 수 (stages: ladder.js 의 STAGES)
export function simulateLadder(stages, { kind = 'tell', rounds = 1000, games = 400, seed = 1, channels } = {}) {
  return stages.map((s, i) => {
    const one = simulate(kind, rounds, seed + i * 101, s, channels)
    const g = games ? simulateGames(kind, games, seed + i * 101 + 50, s, channels) : null
    return { stage: s.stage, hit: one.hit, tbRate: one.tbRate, trials: one.trials, lateRate: one.lateRate, clear: g ? g.clear : null }
  })
}
