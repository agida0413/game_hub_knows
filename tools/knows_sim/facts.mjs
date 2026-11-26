// '세어 둔 것' 분포 — 봇별 5묶음 × N판에서 어떤 관찰이 나오나 (기록이라 늘 참 · 망설임 시간은 봇에 없어 빠짐)
import { BOTS, playGame } from '../../frontend/src/games/knows/bots.js'
import { SITUATIONS } from '../../frontend/src/games/knows/situations.js'
import { analyze } from '../../frontend/src/games/knows/engine.js'
import { factOf } from '../../frontend/src/games/knows/result.js'
import { factLine } from '../../frontend/src/games/knows/lines.js'
const N = Number(process.argv[2] || 20)
console.log('| 유형 | 읽히면 바꿈 | 돌아옴 | 특징 | 가장 많이 고른 쪽 | 예시 |')
console.log('|---|---|---|---|---|---|')
for (const [id, bot] of Object.entries(BOTS)) {
  const c = {}
  let ex = ''
  for (let b = 0; b < 5; b++) for (let g = 0; g < N; g++) {
    const st = playGame(bot, SITUATIONS, 9000 + b * 1000 + g).state
    const f = factOf(st, analyze(st))
    c[f.code] = (c[f.code] || 0) + 1
    if (!ex || f.code !== 'top') ex = factLine(f)
  }
  console.log(`| ${bot.name} | ${c.shift_after_caught || 0} | ${c.bounce || 0} | ${c.feature || 0} | ${c.top || 0} | ${ex} |`)
}
