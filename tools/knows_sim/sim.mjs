// 「AI KNOWS YOU」 예측 엔진 시뮬레이션 — 가상 플레이어 유형별 적중률 vs 우연(1/k) vs 이론상 천장(봇의 규칙을 아는 예측)
//   node tools/knows_sim/sim.mjs [판 수=1000] [rich] [phase] [noheader] [bots=random+repeat] [eta=2,gamma=0.8,mix=none+freq …(TUNING 덮어쓰기)]
//   표는 reports/design_knows.md 에 붙인다. LLM · 네트워크 없음. 같은 인자면 같은 결과(seed 고정)
import { BOTS, simulate } from '../../frontend/src/games/knows/bots.js'
import { TUNING } from '../../frontend/src/games/knows/engine.js'
import { SITUATIONS, TAGS } from '../../frontend/src/games/knows/situations.js'

const args = process.argv.slice(2)
const G = Number(args.find((a) => /^\d+$/.test(a)) || 1000)
for (const a of args) for (const kv of a.split(',')) { const [k, v] = kv.split('='); if (k === 'mix') TUNING.mix = v.split('+'); else if (k in TUNING && v) TUNING[k] = Number(v) }
const only = (args.find((a) => a.startsWith('bots=')) || '').slice(5).split('+').filter(Boolean)
const pct = (x) => (x * 100).toFixed(1)

// 비교용: 모든 라운드에 네 성향이 다 있는 '넉넉한' 상황 세트 (선택지 구성의 한계 vs 엔진의 한계를 나눠 보려고)
const RICH = SITUATIONS.map((s, i) => {
  const order = [...TAGS]
  for (let j = 0; j < i % 4; j++) order.push(order.shift())
  if (i % 2) order.reverse()
  return { id: `rich${i}`, options: order.map((t) => ({ label: t, tag: t })), lean: {} }
})

const sets = args.includes('richonly') ? [] : [['실제 20문항', SITUATIONS]]
if (args.includes('rich') || args.includes('richonly')) sets.push(['넉넉한 세트(매번 4지 · 네 성향)', RICH])
for (const [label, sits] of sets) {
  if (!args.includes('noheader')) {
    console.log(`\n## ${label} · ${G}판씩 · TUNING ${JSON.stringify(TUNING)}`)
    console.log('| 유형 | 1~20R | 9~20R (95% CI) | 우연 1/k | 천장 | 천장 대비 | 평균 확신도 |')
    console.log('|---|---|---|---|---|---|---|')
  }
  let gap = 0
  for (const [id, bot] of Object.entries(BOTS)) {
    if (only.length && !only.includes(id)) continue
    const all = simulate(bot, sits, G)
    const late = simulate(bot, sits, G, { after: 8, oracle: 256 })
    const cap = (late.acc - late.chance) / Math.max(1e-9, late.oracle - late.chance)
    if (id !== 'random') gap += late.oracle - late.acc
    console.log(`| ${bot.name} (\`${id}\`) | ${pct(all.acc)}% | **${pct(late.acc)}%** (${pct(late.lo)}–${pct(late.hi)}) | ${pct(late.chance)}% | ${pct(late.oracle)}% | ${id === 'random' ? '—' : pct(cap) + '%'} | ${pct(late.conf)}% |`)
    if (args.includes('phase')) {
      const ph = [0, 5, 10, 15].map((a) => simulate(bot, sits.slice(0, a + 5), G, { after: a }).acc)
      console.log(`| ↳ \`${id}\` 단계별 1~5 · 6~10 · 11~15 · 16~20 | ${ph.map(pct).join(' · ')} | | | | | |`)
    }
  }
  console.log(`천장과의 거리 합(무작위 제외): ${pct(gap)}`)
}
