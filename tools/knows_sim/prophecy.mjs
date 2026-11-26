// 예언 검증 — AT(기본 10)라운드 뒤 봉인한 문장이 끝에서 얼마나 맞나 (봇 유형별) · 계산 시간
import { BOTS, playGame } from '../../frontend/src/games/knows/bots.js'
import { SITUATIONS } from '../../frontend/src/games/knows/situations.js'
import { checkProphecy, newGame, predict, prophesy, resolve, TUNING } from '../../frontend/src/games/knows/engine.js'
if (process.argv[8]) TUNING.prophecyTemp = Number(process.argv[8])
const G = Number(process.argv[2] || 40), SIMS = Number(process.argv[3] || 40), AT = Number(process.argv[4] || 10)
console.log('| 유형 | 예언이 맞은 비율 | 엔진이 말한 확률(평균) | 자주 나온 예언 | 계산 시간(평균) |')
console.log('|---|---|---|---|---|')
for (const [id, bot] of Object.entries(BOTS)) {
  let ok = 0, n = 0, pSum = 0, ms = 0
  const codes = {}
  for (let g = 0; g < G; g++) {
    const full = playGame(bot, SITUATIONS, 900 + g)
    let st = newGame({ seed: 900 + g })
    full.state.rounds.slice(0, AT).forEach((r, i) => { const p = predict(st, SITUATIONS[i], { shown: i >= 5 }); st = resolve(st, p, r.choice) })
    // 같은 봇 · 같은 seed 로 다시 굴린 판의 앞 5라운드가 같으므로, 끝난 판(full)으로 맞았는지 본다
    const t0 = performance.now()
    const pr = prophesy(st, SITUATIONS, { sims: SIMS, humility: Number(process.argv[5] ?? 0.15), minProb: Number(process.argv[6] ?? 0.7), maxBase: Number(process.argv[7] ?? 0.3) })
    ms += performance.now() - t0
    if (!pr) continue
    n++; pSum += pr.prob
    if (checkProphecy(pr, full.state)) ok++

    codes[pr.code] = (codes[pr.code] || 0) + 1
  }
  const top = Object.entries(codes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, k]) => `${c} ${k}`).join(', ')
  console.log(`| ${bot.name} | ${n ? Math.round(ok / n * 100) : "-"}% (${ok}/${n}, 예언 안 함 ${G - n}) | ${n ? Math.round(pSum / n * 100) : '-'}% | ${top} | ${Math.round(ms / G)}ms |`)
}
