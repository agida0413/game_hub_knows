// 예언 · 작은 예고 검증 — 10라운드 뒤 봉인 → 끝에서 맞았나. 5묶음(seed 다름) × N판, 봇 하나씩
//   node tools/knows_sim/small.mjs <봇> [판 수/묶음=20] [smallProb=0.85] [smallBase=0.5] [보정 1|0=1]
//   출력 열: 예언 맞힘 · 작은 예고 맞힘 · 묶음별 작은 예고 적중 · 둘 다 없음 · 규칙 문장의 날카로움(남은 횟수 중 몇 번 · 평균) · 자주 나온 것 · 예시
import { BOTS, playGame } from '../../frontend/src/games/knows/bots.js'
import { SITUATIONS } from '../../frontend/src/games/knows/situations.js'
import { checkProphecy, newGame, predict, prophesyAll, resolve, TUNING } from '../../frontend/src/games/knows/engine.js'
import { prophecyText } from '../../frontend/src/games/knows/lines.js'

const [id, nArg, sp, sb, cal] = process.argv.slice(2)
const N = Number(nArg || 20)
if (cal != null) TUNING.prophecyTemp = Number(cal)
if (process.env.PULL) TUNING.tempPull = Number(process.env.PULL)
if (process.env.TMAX) TUNING.tempMax = Number(process.env.TMAX)
if (process.env.STR) TUNING.smallStrength = Number(process.env.STR)
const bot = BOTS[id]
const batches = []
const codes = {}
const sharp = []
let example = ''
for (let b = 0; b < 5; b++) {
  const s = { mainMade: 0, mainRight: 0, smallMade: 0, smallRight: 0, none: 0 }
  for (let g = 0; g < N; g++) {
    const seed = 5000 + b * 1000 + g
    const full = playGame(bot, SITUATIONS, seed)
    let st = newGame({ seed })
    full.state.rounds.slice(0, 10).forEach((r, i) => { const p = predict(st, SITUATIONS[i], { shown: i >= 5 }); st = resolve(st, p, r.choice) })
    const { main, small } = prophesyAll(st, SITUATIONS, { sims: 30, smallProb: Number(sp || 0.85), smallBase: Number(sb || 0.5) })
    const pr = main || small
    if (pr?.code === 'keeps') sharp.push(pr.m / pr.of)
    if (main) { s.mainMade++; if (checkProphecy(main, full.state)) s.mainRight++ }
    else if (small) {
      s.smallMade++
      if (checkProphecy(small, full.state)) s.smallRight++
      const k = small.code === 'keeps' ? `keeps:${small.rule}` : small.code
      codes[k] = (codes[k] || 0) + 1
      if (!example || small.code === 'keeps') example = prophecyText(small)
    } else s.none++
  }
  batches.push(s)
}
const sum = (k) => batches.reduce((a, s) => a + s[k], 0)
const accs = batches.filter((s) => s.smallMade).map((s) => s.smallRight / s.smallMade)
const pct = (x) => `${Math.round(x * 100)}%`
const top = Object.entries(codes).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c, k]) => `${c} ${k}`).join(', ')
const sh = sharp.length ? pct(sharp.reduce((a, b) => a + b, 0) / sharp.length) : '-'
console.log(`| ${bot.name} | ${sum('mainRight')}/${sum('mainMade')} | ${sum('smallRight')}/${sum('smallMade')} (${sum('smallMade') ? pct(sum('smallRight') / sum('smallMade')) : '-'}) | ${accs.length ? `${pct(Math.min(...accs))}~${pct(Math.max(...accs))}` : '-'} | ${sum('none')} | ${sh} | ${top} | ${example} |`)
