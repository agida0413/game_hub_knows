// 분석(analyze)이 가상 플레이어의 정체를 알아보는가 — 봇별 30판의 행동 유형 · 일관성 중앙값 · 첫 번째 특징
import { BOTS, playGame } from '../../frontend/src/games/knows/bots.js'
import { SITUATIONS } from '../../frontend/src/games/knows/situations.js'
import { analyze } from '../../frontend/src/games/knows/engine.js'
for (const id of Object.keys(BOTS)) {
  const out = []
  for (let g = 0; g < 30; g++) { const a = analyze(playGame(BOTS[id], SITUATIONS, 500 + g).state); out.push(a) }
  const types = {}; for (const a of out) types[a.type] = (types[a.type] || 0) + 1
  const cons = out.map((a) => a.consistency).sort((a, b) => a - b)
  const feats = {}; for (const a of out) for (const f of a.features.slice(0, 1)) feats[f.code] = (feats[f.code] || 0) + 1
  console.log(id.padEnd(12), 'cons med', cons[15], 'types', JSON.stringify(types), 'lead', JSON.stringify(feats))
}
