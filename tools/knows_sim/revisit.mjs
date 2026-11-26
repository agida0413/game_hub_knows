// 재방문 비교 — 같은 봇이 두 판(5묶음 × N쌍): '지난번보다 덜/더 읽힘 · 적중 a→b%' 분포와 참 여부
import { BOTS, playGame } from '../../frontend/src/games/knows/bots.js'
import { SITUATIONS } from '../../frontend/src/games/knows/situations.js'
import { analyze, memoryOf } from '../../frontend/src/games/knows/engine.js'
import { compareLast } from '../../frontend/src/games/knows/result.js'
import { lastLine } from '../../frontend/src/games/knows/lines.js'
const N = Number(process.argv[2] || 20)
console.log('| 유형 | 덜 읽힘 | 더 읽힘 | 같음 | 참 | 예시 |')
console.log('|---|---|---|---|---|---|')
for (const [id, bot] of Object.entries(BOTS)) {
  const c = { less: 0, more: 0, same: 0 }
  let ok = 0, n = 0, ex = ''
  for (let b = 0; b < 5; b++) for (let g = 0; g < N; g++) {
    const s = 70000 + b * 1000 + g * 2
    const a1 = analyze(playGame(bot, SITUATIONS, s).state), a2 = analyze(playGame(bot, SITUATIONS, s + 1).state)
    const x = compareLast(memoryOf(a1), a2)
    c[x.dir]++; n++
    const f = Math.round(a1.accuracy * 100), t = Math.round(a2.accuracy * 100)
    if (x.from === f && x.to === t && x.dir === (t < f ? 'less' : t > f ? 'more' : 'same')) ok++
    ex = lastLine(x)
  }
  console.log(`| ${bot.name} | ${c.less} | ${c.more} | ${c.same} | ${ok}/${n} | ${ex} |`)
}
