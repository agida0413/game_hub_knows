// 「숨긴 사진」 판정 엔진 — 순수 함수 (react · 브라우저 없음 · node --test 로 검증)
//   방식: 은닉 정보 검사(반응 시간형). 사진이 지나갈 때마다 '아니'를 누르게 하고, 숨긴 사진에서만 손이 늦어지는지 본다.
//   반응 시간 원자료는 이 함수들 안에서만 쓰고 저장 · 전송하지 않는다. 화면에 나가는 것은 사진별 요약 숫자(늦어진 ms · 확률)뿐.
//
//   한 묶음(사진 다섯 장 x 6번 = 30번) 판정 순서
//     1) 버리는 것: 테두리('예') 칸 · 150ms 미만(미리 누름)
//        '예'를 잘못 누른 칸은 시간 대신 '실수 한 번'으로 센다. 제한 시간을 넘긴 칸은 제한 시간 값으로 넣는다(가장 늦음)
//     2) 로그 반응 시간으로 바꾸고(오른쪽 꼬리 줄이기), 크게 튄 값은 중앙값 ± 4 MAD 로 미리 자른다
//     3) 방해 요인을 사진 효과와 함께 맞춘다(번갈아 최소제곱): 첫 노출(처음 보는 사진은 누구나 늦다) · 연습 효과(뒤로 갈수록
//        빨라짐) · 전환 늦음('예' 칸이나 실수 바로 다음). 첫 노출은 버리지 않고 맞춘다 — 버리면 칸이 줄어 적중률이 떨어진다(시뮬레이션)
//     4) 개인 기준선: 사진 효과를 뺀 나머지의 퍼짐(MAD)으로 이 사람의 '한 칸 흔들림' 크기를 잡는다(작은 판이라 기본값과 섞음)
//        나머지가 ±2.5 를 넘는 칸은 잘라 낸다(멍때림 · 일부러 늦추기를 약하게)
//     5) 사진별 점수 = (그 사진 평균 - 다섯 사진 평균) / 개인 흔들림 — 표준화한 '늦어짐'
//     6) 가설 여섯 개(숨긴 사진이 0~4번 · 아무 신호 없음)의 가능도로 확률을 낸다. 확신이 낮으면 두 장만 한 번 더(둘 중 하나)
//
//   AI 단계(ladder.js)는 이 엔진을 그대로 쓰고 숫자만 바꾼다 — 사진 수 · 반복 · 다시 보기 횟수(tbMax) · 다시 보기 기준(confTb)
//   · 다시 볼 장수(tbK: 둘 중 하나 · 셋 중 하나) · 사진 간격(isi) · 제한 시간(deadline). 아래 상수는 그 기본값(옛 한 판)

export const ITEMS = 5          // 한 라운드 사진 수
export const REPS = 6           // 사진마다 나오는 횟수 (그중 1번은 테두리, '아니' 칸 25 · 약 26초)
export const TB_REPS = 4        // '둘 중 하나' 때 사진마다 나오는 횟수
export const DEADLINE = 1100    // ms — 이 안에 안 누르면 '늦음'으로 기록하고 넘어간다
export const MIN_RT = 150       // ms — 이보다 빠르면 사진을 보기 전에 누른 것
export const ISI_MIN = 300      // ms — 누른 뒤 다음 사진까지 (무작위로 흔들어 박자로 미리 누르기를 막는다)
export const ISI_MAX = 500
export const MIN_SOA = 600      // ms — 사진이 바뀌는 간격의 하한 (1초에 1.7번 이하 · 깜빡임 기준 3번보다 훨씬 아래)
export const LEAD_IN = 800      // ms — 첫 사진 전 준비
export const D_PRIOR = 1        // 숨긴 사진의 기대 늦어짐 (개인 흔들림 단위) — 시뮬레이션으로 맞춘 값
export const NOISE_VF = 1.3     // 사진 점수의 실제 흔들림 / 모형 흔들림 (작은 판 · 꼬리 때문에 1보다 크다 — 시뮬레이션으로 잰 값)
export const NULL_PRIOR = 0.3   // '신호 없음' 가설의 사전 확률
export const CONF_TB = 0.5      // 이 확신 아래면 '둘 중 하나'를 한 번 더
export const PRIOR_SCALE = 0.16 // 로그 반응 시간 흔들림의 기본값 (약 ±16%)
export const PRIOR_K = 8        // 기본값의 무게 (칸 8개 분량)
export const CAP_Z = 2.5        // 나머지 자르기 기준
export const ERR_Z = 1          // '예'를 잘못 누른 칸 = 이만큼 늦은 칸 하나로 친다

// 씨앗 있는 난수 (mulberry32) — 같은 씨앗이면 같은 순서
export function rngOf(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle(arr, rng) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = a[i]; a[i] = a[j]; a[j] = t
  }
  return a
}

const between = (rng, lo, hi) => Math.round(lo + rng() * (hi - lo))

// 순서 — 세 장 이상이면 '한 바퀴에 한 번씩'(바퀴 경계에서도 같은 사진 연속 없음), 두 장이면 같은 사진 세 번 연속 없음
//   테두리('예')는 사진마다 한 번, 처음 두 칸 · 연속 두 칸에는 두지 않는다
//   isi: [하한, 상한] ms — 단계가 오르면 조금 짧아진다(사진이 바뀌는 간격 하한 MIN_SOA 는 화면이 따로 지킨다)
export function buildSequence(items, reps, rng, isi = [ISI_MIN, ISI_MAX]) {
  for (let tries = 0; tries < 400; tries++) {
    const order = []
    if (items.length >= 3) {
      for (let c = 0; c < reps; c++) {
        let p = shuffle(items, rng)
        if (order.length && p[0] === order[order.length - 1]) { const t = p[0]; p[0] = p[1]; p[1] = t }
        order.push(...p)
      }
    } else {
      const pool = shuffle(items.flatMap((x) => Array(reps).fill(x)), rng)
      let ok = true
      for (let i = 2; i < pool.length; i++) if (pool[i] === pool[i - 1] && pool[i] === pool[i - 2]) ok = false
      if (!ok) continue
      order.push(...pool)
    }
    const target = new Array(order.length).fill(false)
    let ok = true
    for (const it of shuffle(items, rng)) {
      const spots = order.map((x, i) => (x === it ? i : -1)).filter((i) => i >= 2 && !target[i - 1] && !target[i + 1])
      if (!spots.length) { ok = false; break }
      target[spots[Math.floor(rng() * spots.length)]] = true
    }
    if (!ok) continue
    return order.map((item, i) => ({ item, target: target[i], isi: between(rng, isi[0], isi[1]) }))
  }
  throw new Error('순서를 만들 수 없음')
}

// 정답 버튼 — 테두리면 '예', 아니면 '아니'
export const expected = (trial) => (trial.target ? 'yes' : 'no')

const median = (xs) => {
  if (!xs.length) return 0
  const a = xs.slice().sort((p, q) => p - q)
  const m = a.length >> 1
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))

// 최소제곱 (작은 연립방정식 · 가우스 소거) — 특이하면 null
function solve(A, b) {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    if (Math.abs(M[p][c]) < 1e-9) return null
    const t = M[c]; M[c] = M[p]; M[p] = t
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / M[c][c]
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return M.map((row, i) => row[n] / row[i])
}

// 방해 요인 맞추기 — 사진 효과를 뺀 나머지에 최소제곱. 열: 상수 + 고른 것
//   t: 칸 번호(가운데로 · /10) — 길게 보는 연습 효과   w: exp(-칸/5) — 시작 몸풀기
//   s: '예' 칸이나 실수 바로 다음(전환 늦음)            f: 그 사진의 첫 노출
//   연습 효과 계수는 부호 제한 없음, 전환 · 첫 노출 · 몸풀기는 '늦게 만드는' 쪽(0 이상)만 받는다
const COV = { t: (r) => r.tc, w: (r) => r.w, s: (r) => r.s, f: (r) => r.f }
function fitNuisance(rows, resid, use) {
  const names = use.filter((c) => { const v = rows.map(COV[c]); return v.some((x) => x !== v[0]) })
  const cols = [() => 1, ...names.map((c) => COV[c])]
  const A = cols.map((f) => cols.map((g) => rows.reduce((a, r) => a + f(r) * g(r), 0)))
  const b = cols.map((f) => rows.reduce((a, r, i) => a + f(r) * resid[i], 0))
  const beta = rows.length > cols.length + 1 ? solve(A, b) : null
  const out = { t: 0, w: 0, s: 0, f: 0 }
  if (!beta) return out
  names.forEach((c, i) => { out[c] = c === 't' ? beta[i + 1] : Math.max(0, beta[i + 1]) })
  return out
}

// 기본은 t · s · f (시뮬레이션 비교: 몸풀기 w 까지 넣으면 f 와 겹쳐 오히려 조금 떨어짐)
export const COVARIATES = ['t', 's', 'f']

/**
 * 한 묶음 판정
 * @param trials [{ item, target, resp: 'no'|'yes'|null, rt, away? }] — 보여 준 순서대로. resp null = 제한 시간 넘김 · away = 화면을 떠나 있던 칸(뺀다)
 * @param items  이 묶음에 나온 사진 번호들
 * @param opt    first('cov' 첫 노출을 방해 요인으로 맞춤 · 'drop' 버림 · 'keep' 그대로) · dropFirst(맨 앞 몇 칸 버리기)
 *               cov(맞출 방해 요인) · scale(개인 흔들림 고정값 — '둘 중 하나'는 본 묶음 값을 쓴다) · priorScale(앞 라운드 흔들림)
 *               capZ(나머지 자르기) · log(로그 반응 시간) · deadline(이 단계의 제한 시간 — 넘긴 칸은 이 값으로)
 * @returns { S: {item: 표준화 점수}, n: {item: 판정 칸 수}, lateMs: {item: 다른 사진보다 늦은 ms}, scale, baseMs, used, dropped }
 */
export function analyze(trials, items, opt = {}) {
  const {
    first: firstMode = 'cov', dropFirst = 0, cov = COVARIATES, scale: fixedScale = null, priorScale = PRIOR_SCALE, capZ = CAP_Z, log = true,
    deadline = DEADLINE,
  } = opt
  const tf = log ? Math.log : (x) => x / 500
  const inv = log ? Math.exp : (x) => x * 500
  const seen = new Set()
  const rows = []
  const errs = Object.fromEntries(items.map((i) => [i, 0]))
  let post = false
  let dropped = 0
  trials.forEach((tr, k) => {
    if (tr.away) { post = true; return }   // 화면을 떠나 있던 칸(game.js 'away') — 빼고, 돌아온 다음 칸은 전환 늦음으로 맞춘다
    const first = !seen.has(tr.item)
    seen.add(tr.item)
    const wasPost = post
    post = tr.target || tr.resp !== expected(tr)
    if (tr.target || !(tr.item in errs)) return
    if (k < dropFirst || (firstMode === 'drop' && first)) { dropped++; return }
    if (tr.resp === 'yes') { errs[tr.item]++; return }
    const rt = tr.resp == null ? deadline : tr.rt
    if (!(rt >= MIN_RT)) { dropped++; return }
    rows.push({ item: tr.item, y: tf(Math.min(rt, deadline)), k, s: wasPost ? 1 : 0, f: firstMode === 'cov' && first ? 1 : 0, w: Math.exp(-k / 5) })
  })
  const S = {}
  const n = {}
  const lateMs = {}
  if (rows.length < 2) {
    for (const i of items) { S[i] = 0; n[i] = errs[i]; lateMs[i] = 0 }
    return { S, n, lateMs, scale: fixedScale || priorScale, baseMs: 0, used: rows.length, dropped }
  }
  // 2) 크게 튄 값 미리 자르기
  const med = median(rows.map((r) => r.y))
  const mad0 = 1.4826 * median(rows.map((r) => Math.abs(r.y - med))) || priorScale
  for (const r of rows) r.y = clamp(r.y, med - 4 * mad0, med + 4 * mad0)
  const kMean = mean(rows.map((r) => r.k))
  for (const r of rows) r.tc = (r.k - kMean) / 10
  // 3) 사진 효과 + 방해 요인 (번갈아 맞추기 = 함께 맞춘 최소제곱과 같은 답으로 모인다)
  const m = Object.fromEntries(items.map((i) => [i, mean(rows.filter((r) => r.item === i).map((r) => r.y))]))
  let nui = { t: 0, w: 0, s: 0, f: 0 }
  const valueOf = (r) => r.y - nui.t * r.tc - nui.w * r.w - nui.s * r.s - nui.f * r.f
  for (let it = 0; it < 6; it++) {
    if (cov.length) nui = fitNuisance(rows, rows.map((r) => r.y - m[r.item]), cov)
    for (const i of items) {
      const v = rows.filter((r) => r.item === i).map(valueOf)
      m[i] = v.length ? mean(v) : 0
    }
  }
  // 4) 개인 흔들림 — 사진 효과를 뺀 나머지의 MAD (자유도 보정) 를 기본값과 섞는다
  const cnt = Object.fromEntries(items.map((i) => [i, rows.filter((r) => r.item === i).length]))
  let scale = fixedScale
  if (!scale) {
    const res = rows.map((r) => valueOf(r) - m[r.item])
    const frac = mean(rows.map((r) => (cnt[r.item] > 1 ? (cnt[r.item] - 1) / cnt[r.item] : 1)))
    const sMad = (1.4826 * median(res.map(Math.abs))) / Math.sqrt(frac || 1)
    const df = Math.max(1, rows.length - items.length - cov.length)
    scale = Math.sqrt((PRIOR_K * priorScale * priorScale + df * sMad * sMad) / (PRIOR_K + df))
    scale = Math.max(0.05, scale)
  }
  // 나머지 자르기 (두 번) — 한 칸이 사진 점수를 좌우하지 못하게
  for (let it = 0; it < 2; it++) {
    for (const i of items) {
      const v = rows.filter((r) => r.item === i).map((r) => m[i] + clamp(valueOf(r) - m[i], -capZ * scale, capZ * scale))
      if (v.length) m[i] = mean(v)
    }
  }
  // 5) 표준화 점수 — 실수 칸은 ERR_Z 만큼 늦은 칸 하나로 섞는다
  const withData = items.filter((i) => cnt[i] > 0)
  const grand = mean(withData.map((i) => m[i]))
  for (const i of items) {
    const z = cnt[i] ? (m[i] - grand) / scale : 0
    n[i] = cnt[i] + errs[i]
    S[i] = n[i] ? (z * cnt[i] + ERR_Z * errs[i]) / n[i] : 0
    const others = withData.filter((j) => j !== i)
    lateMs[i] = cnt[i] && others.length ? Math.round(inv(m[i]) - inv(mean(others.map((j) => m[j])))) : 0
  }
  return { S, n, lateMs, scale, baseMs: Math.round(inv(grand)), used: rows.length, dropped }
}

// 손가락 신호(손이 닿아 있던 시간 dw · 버튼 가운데에서 벗어난 정도 off) — 반응 시간과 같은 방식으로 사진별 점수만 낸다
//   '아니'를 맞게 누른 칸만 · 값이 없는 칸은 건너뜀 · 칸이 모자라면 null(그 신호는 쓰지 않는다)
export function analyzeSide(trials, items, key) {
  const rows = trials.filter((t) => !t.target && t.resp === 'no' && Number.isFinite(t[key]) && items.includes(t.item))
  if (rows.length < items.length * 2) return null
  const tf = key === 'dw' ? (x) => Math.log(Math.max(20, x)) : (x) => x
  const ys = rows.map((t) => tf(t[key]))
  const med = median(ys)
  const sd = 1.4826 * median(ys.map((y) => Math.abs(y - med)))
  if (!(sd > 1e-6)) return null
  const z = ys.map((y) => clamp((y - med) / sd, -3, 3))
  const cnt = Object.fromEntries(items.map((i) => [i, rows.filter((t) => t.item === i).length]))
  const m = Object.fromEntries(items.map((i) => [i, mean(rows.map((t, k) => (t.item === i ? z[k] : null)).filter((x) => x !== null))]))
  const withData = items.filter((i) => cnt[i] > 0)
  const grand = mean(withData.map((i) => m[i]))
  const S = {}
  for (const i of items) S[i] = cnt[i] ? m[i] - grand : 0
  return { S, n: cnt }
}

// ---- 개인 습관 학습 (같은 판 안에서) — 라운드가 끝나면 진짜 답을 아니까, 이 사람에게 어느 신호가 통했는지 배운다 ----
//   관찰: 진짜 사진의 점수 - 나머지 평균 = 그 신호가 이 사람에게서 낸 차이(d). 지난 라운드들의 평균을 기본값과 섞어(prior 라운드 몫) 다음 라운드의 d 로 쓴다
//   통하지 않은 신호는 d 가 0 쪽으로 줄어 저절로 꺼진다
export const HABIT_KEYS = ['rt', 'dw', 'off']
export const habitInit = () => ({ k: 0, sum: { rt: 0, dw: 0, off: 0 }, cnt: { rt: 0, dw: 0, off: 0 } })
export function habitUpdate(h, sig, real, items) {
  const k = { ...h, sum: { ...h.sum }, cnt: { ...h.cnt }, k: h.k + 1 }
  for (const key of HABIT_KEYS) {
    const sd = sig[key]
    if (!sd || !(real in sd.S)) continue
    const others = items.filter((i) => i !== real && sd.n[i] > 0)
    if (!others.length || !(sd.n[real] > 0)) continue
    k.sum[key] += sd.S[real] - mean(others.map((i) => sd.S[i]))
    k.cnt[key] += 1
  }
  return k
}
// 다음 라운드의 신호 묶음 — base: 처음 값(신호별 d · vf), w0: 처음 값의 무게(라운드 몫), c0: 첫 라운드에 처음 값을 얼마나 믿을지(0~1)
export function habitChannels(h, base, { w0 = 2, c0 = 1, m0 = 1 } = {}) {
  const out = { ds: base.ds }
  for (const key of ['dw', 'off']) {
    const b = base[key]
    if (!b) continue
    const c = h ? h.cnt[key] : 0
    const d = h && c ? Math.max(0, (w0 * b.d * m0 + h.sum[key]) / (w0 + c)) : b.d * c0
    out[key] = { d, vf: b.vf }
  }
  if (h && h.cnt.rt) {
    const dh = Math.max(0.3, (w0 * base.ds[Math.floor(base.ds.length / 2)] + h.sum.rt) / (w0 + h.cnt.rt))
    out.ds = base.ds.map((x) => x * dh / base.ds[Math.floor(base.ds.length / 2)])
  }
  return out
}

// 화면이 쓰는 값 — 정하기 전 기본(신호 없음)
//   손가락 신호(닿은 시간 dw · 터치 쏠림 off): d 는 '그 신호가 나올 때' 기대 차이(한 칸 흔들림 단위) · vf 는 잡음 배율. 시뮬레이션으로 정한 값
//   처음엔 0 에서 시작해(c0 0 · m0 0) 라운드마다 진짜 답과 맞춰 본 것만큼만 키운다 — 신호가 없는 사람은 판정이 그대로(적중률 손실 0)
//   퍼짐(v)은 넣어 봤으나 오르지 않아 뺐다
export const LEARN_BASE = { ds: [D_PRIOR], dw: { d: 0.35, vf: 1.6 }, off: { d: 0.3, vf: 1.6 } }
export const HABIT_OPT = { w0: 1, c0: 0, m0: 0 }

// 근거 한 줄 — AI 가 고른 사진에서 '아니'를 누른 칸 중 몇 번이 다른 사진들의 중앙값보다 늦었나 (숫자 두 개만 남긴다)
export function evidence(trials, item, deadline = DEADLINE) {
  const rows = trials.filter((t) => !t.target && !t.away && t.resp !== 'yes' && (t.resp === null || t.rt >= MIN_RT))
  const rt = (t) => (t.resp === null ? deadline : t.rt)
  const base = median(rows.filter((t) => t.item !== item).map(rt))
  const mine = rows.filter((t) => t.item === item)
  return { k: mine.filter((t) => rt(t) > base).length, of: mine.length }
}

// 쓰는 신호 묶음(시뮬레이션이 바꿔 가며 재는 스위치) — ds: 숨긴 사진의 기대 늦어짐 후보(개인 흔들림 단위, 섞어서 쓴다)
//   dw: 손이 닿은 시간 · off: 터치 쏠림. 각 신호의 d(기대 차이) · vf(잡음 배율). 기본은 신호 없음(옛 판정)
export const CHANNELS = { ds: [D_PRIOR], dw: null, off: null }

// 한 묶음의 로그 가능도 — 가설 j: 사진 j 만 d 만큼 늦다 · 가설 0: 모두 같다 (공통 위치 c 는 최대가능도로 뺀다)
export function blockLogLik(block, items, d = D_PRIOR, vf = NOISE_VF) {
  const N = items.reduce((a, i) => a + block.n[i], 0)
  const sum = items.reduce((a, i) => a + block.n[i] * block.S[i], 0)
  const ss = (c, j) => items.reduce((a, i) => a + block.n[i] * (block.S[i] - c - (i === j ? d : 0)) ** 2, 0)
  const ll0 = N ? (-0.5 * ss(sum / N, -1)) / vf : 0
  const ll = {}
  for (const j of items) ll[j] = N ? (-0.5 * ss((sum - block.n[j] * d) / N, j)) / vf : 0
  return { ll, ll0 }
}

export const TIE_EPS = 1e-9   // 확률 차이가 이보다 작으면 같다고 본다(계산 찌꺼기)

/**
 * 여러 묶음(본 진행 + 둘 중 하나)을 합친 확률
 * @param blocks [{ items, S, n }]
 * @param all    라운드의 사진 번호 전체
 * @param tie    확률이 같을 때(신호가 하나도 없을 때)의 순서 — {사진 번호: 순위}. 없으면 사진 번호 순
 *               (11/25: 없으면 연타 · 안 누름 · 늘 '예'일 때 AI 가 늘 첫 사진을 골라, 그것만 피해 숨기면 이겼다)
 * @returns { p: {item: 숨긴 사진일 확률}, pNull, order: 확률 높은 순, conf: 1위 확률 }
 */
export function posterior(blocks, all, { ds = CHANNELS.ds, nullPrior = NULL_PRIOR, tie = null } = {}) {
  const prior = Math.log((1 - nullPrior) / all.length)
  const perD = ds.map((dk) => {
    const logs = Object.fromEntries(all.map((j) => [j, prior]))
    let log0 = Math.log(nullPrior)
    for (const b of blocks) {
      const { ll, ll0 } = blockLogLik(b, b.items, b.d ?? dk, b.vf ?? NOISE_VF)
      log0 += ll0
      for (const j of all) logs[j] += j in ll ? ll[j] : ll0
    }
    return { logs, log0 }
  })
  // 기대 늦어짐을 모르니 후보들을 같은 무게로 섞는다 (가능도의 평균)
  const lse = (xs) => { const m = Math.max(...xs); return m + Math.log(xs.reduce((a, x) => a + Math.exp(x - m), 0) / xs.length) }
  const logs = Object.fromEntries(all.map((j) => [j, lse(perD.map((q) => q.logs[j]))]))
  const log0 = lse(perD.map((q) => q.log0))
  const mx = Math.max(log0, ...all.map((j) => logs[j]))
  const w = Object.fromEntries(all.map((j) => [j, Math.exp(logs[j] - mx)]))
  const w0 = Math.exp(log0 - mx)
  const tot = w0 + all.reduce((a, j) => a + w[j], 0)
  const pNull = w0 / tot
  // '신호 없음'이어도 비밀은 다섯 중 하나 — 그 몫은 고르게 나눈다
  const p = Object.fromEntries(all.map((j) => [j, w[j] / tot + pNull / all.length]))
  const rank = (j) => (tie && Number.isFinite(tie[j]) ? tie[j] : j)
  // 계산 찌꺼기(1e-15 쯤)로 갈리는 '사실상 같음'도 같음으로 본다
  const order = all.slice().sort((a, b) => (Math.abs(p[b] - p[a]) > TIE_EPS ? p[b] - p[a] : rank(a) - rank(b) || a - b))
  return { p, pNull, order, conf: p[order[0]] }
}

// 라운드마다 다른 동점 순서 — 씨앗에서 뽑은 사진 순위 { 사진 번호: 순위 }
export function tieRank(items, rng) {
  const perm = shuffle(items, rng)
  return Object.fromEntries(perm.map((it, k) => [it, k]))
}

// 다음 할 일 — 확신이 기준(confTb)보다 낮고 다시 보기를 다 쓰지 않았으면 위에서 tbK 장(둘 중 하나 · 셋 중 하나)만 한 번 더
//   tbDone: 이미 한 다시 보기 횟수 (옛 호출처럼 true/false 도 받는다 — true = 1번)
//   cfg: { tbMax(다시 보기 최대 · 기본 1), confTb(기준 · 기본 CONF_TB), tbK(다시 볼 장수 · 기본 2) }
export function decide(post, tbDone, cfg = {}) {
  const { tbMax = 1, confTb = CONF_TB, tbK = 2 } = cfg
  const done = typeof tbDone === 'number' ? tbDone : tbDone ? 1 : 0
  if (done < tbMax && post.conf < confTb) return { action: 'tiebreak', pair: post.order.slice(0, Math.max(2, Math.min(tbK, post.order.length))) }
  return { action: 'reveal', guess: post.order[0] }
}

// 막대 — 사진별 '손이 늦어진 정도'(ms, 음수는 0) · 1위 기준 비율
export function bars(block, items) {
  const late = items.map((i) => Math.max(0, block.lateMs[i] || 0))
  const top = Math.max(60, ...late)
  return items.map((i, k) => ({ item: i, ms: late[k], frac: late[k] / top }))
}

// 다시 보기(둘 중 하나 · 셋 중 하나)를 포함한 한 라운드 판정 — 화면 · 시뮬레이션이 같이 쓴다
//   tbTrials: null · 한 묶음(trial 배열) · 여러 묶음(trial 배열의 배열 — 다시 보기를 여러 번 한 단계)
//   opt: priorScale(앞 라운드 흔들림) · deadline · tbMax · confTb · tbK (ladder.js 의 단계 값) · tie(동점 순서 — tieRank)
export function judgeRound(mainTrials, tbTrials, items, opt = {}) {
  const deadline = opt.deadline || DEADLINE
  const main = analyze(mainTrials, items, { priorScale: opt.priorScale || PRIOR_SCALE, deadline })
  const blocks = [{ items, S: main.S, n: main.n }]
  const C = opt.channels || CHANNELS
  const sig = { rt: { S: main.S, n: main.n } }   // 본 묶음의 신호별 사진 점수(개인 습관 학습용)
  const side = (trials, its, isMain) => {
    const put = (k, sd) => {
      if (isMain) sig[k] = sd
      if (sd && C[k] && C[k].d > 0) blocks.push({ items: its, S: sd.S, n: sd.n, d: C[k].d, vf: C[k].vf })
    }
    for (const k of ['dw', 'off']) put(k, analyzeSide(trials, its, k))
  }
  side(mainTrials, items, true)
  const list = !tbTrials || !tbTrials.length ? [] : Array.isArray(tbTrials[0]) ? tbTrials.filter((b) => b.length) : [tbTrials]
  let tb = null
  for (const b of list) {
    const pair = [...new Set(b.map((t) => t.item))]
    tb = analyze(b, pair, { first: 'keep', dropFirst: 1, scale: main.scale, cov: ['s'], deadline })
    blocks.push({ items: pair, S: tb.S, n: tb.n })
    side(b, pair, false)
  }
  const post = posterior(blocks, items, { ds: C.ds, tie: opt.tie || null })
  const next = decide(post, list.length, opt)
  return { main, tb, tbs: list.length, post, sig, next, ev: next.action === 'reveal' ? evidence(mainTrials, next.guess, deadline) : null }
}

// ---- 습관 이월 — 판이 끝나면 이 사람의 습관 요약(신호별 차이 합 · 본 횟수)만 기기에 남겨 다음 판 첫 라운드부터 쓴다 ----
//   원자료(반응 시간 · 손가락 값)는 없다: 숫자 6개뿐. 본 횟수는 cap 까지만 남겨 오래된 습관이 새 습관을 누르지 못하게 한다(합도 같은 비율로 줄임)
export const HABIT_CAP = 3
export function habitCarry(h, cap = HABIT_CAP) {
  const out = habitInit()
  if (!h) return out
  for (const key of HABIT_KEYS) {
    const c = Math.min(cap, h.cnt[key] | 0)
    out.cnt[key] = c
    out.sum[key] = h.cnt[key] ? (h.sum[key] * c) / h.cnt[key] : 0
  }
  return out
}
// 저장된 글을 믿지 않는다 — 형식이 틀리면 처음 상태
export function cleanHabit(raw) {
  const out = habitInit()
  if (!raw || typeof raw !== 'object' || !raw.sum || !raw.cnt) return out
  for (const key of HABIT_KEYS) {
    const c = raw.cnt[key]
    const s = raw.sum[key]
    if (Number.isInteger(c) && c >= 0 && c <= HABIT_CAP && Number.isFinite(s) && Math.abs(s) <= 20) { out.cnt[key] = c; out.sum[key] = s }
  }
  return out
}
