// 한 라운드 예측 · 한 판 · 예언 계산 시간
import { SITUATIONS } from '../../frontend/src/games/knows/situations.js'
import { newGame, predict, prophesy, resolve, rngOf } from '../../frontend/src/games/knows/engine.js'
const r = rngOf(1)
let t = 0, n = 0, st
for (let g = 0; g < 50; g++) {
  st = newGame({ seed: g })
  SITUATIONS.forEach((s, i) => { const a = performance.now(); const p = predict(st, s, { shown: i >= 5 }); t += performance.now() - a; n++; st = resolve(st, p, Math.floor(r() * p.k)) })
}
const a = performance.now(); let s10 = newGame({ seed: 3 }); SITUATIONS.slice(0, 10).forEach((s, i) => { const p = predict(s10, s, { shown: i >= 5 }); s10 = resolve(s10, p, 0) })
prophesy(s10, SITUATIONS)
console.log(`예측 1회 평균 ${(t / n).toFixed(2)}ms · 예언 1회 ${(performance.now() - a).toFixed(0)}ms · 상태 JSON ${JSON.stringify(st).length}바이트`)
