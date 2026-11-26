// 재방문 사전값 효과 — 같은 사람(같은 봇 설정)이 두 판: 두 번째 판을 사전값 없이 / 있이. 11유형 × 5묶음 × N쌍
//   + '스타일을 바꾼 사람' 두 경우: 편향 A → 편향 B, 반복 → 무작위 (사전값이 해가 되는지)
//   node tools/knows_sim/prior.mjs [N=20]
import { BOTS, playGame } from '../../frontend/src/games/knows/bots.js'
import { SITUATIONS, TAGS } from '../../frontend/src/games/knows/situations.js'
import { setPriorSituations, TUNING } from '../../frontend/src/games/knows/engine.js'
setPriorSituations(SITUATIONS)
if (process.env.PPOS) TUNING.priorPos = Number(process.env.PPOS)
const N = Number(process.argv[2] || 20)
const pct = (x) => (x * 100).toFixed(1)
const acc = (rs, a, b) => { const s = rs.slice(a, b); return s.filter((x) => x.hit).length / s.length }
const chance = (a, b) => SITUATIONS.slice(a, b).reduce((s, x) => s + 1 / x.options.length, 0) / (b - a)
const priorOf = (st) => ({ bySid: Object.fromEntries(st.rounds.map((r) => [r.sid, r.tag])) })

function pairs(bot1, bot2, meMap) {
  const res = { e0: [], e1: [], f0: [], f1: [] }
  for (let b = 0; b < 5; b++) for (let g = 0; g < N; g++) {
    const s = 80000 + b * 1000 + g * 3
    const g1 = playGame(bot1, SITUATIONS, s)
    const me2 = meMap ? meMap(g1.me) : g1.me
    const a = playGame(bot2, SITUATIONS, s + 1, { me: me2 })
    const c = playGame(bot2, SITUATIONS, s + 1, { me: me2, prior: priorOf(g1.state) })
    res.e0.push(acc(a.rounds, 0, 10)); res.e1.push(acc(c.rounds, 0, 10))
    res.f0.push(acc(a.rounds, 0, 20)); res.f1.push(acc(c.rounds, 0, 20))
  }
  const m = (x) => x.reduce((p, q) => p + q, 0) / x.length
  const ci = (x) => { const mu = m(x); return 1.96 * Math.sqrt(x.reduce((p, q) => p + (q - mu) ** 2, 0) / (x.length - 1)) / Math.sqrt(x.length) }
  return { e0: m(res.e0), e1: m(res.e1), de: m(res.e1.map((v, i) => v - res.e0[i])), dci: ci(res.e1.map((v, i) => v - res.e0[i])), f0: m(res.f0), f1: m(res.f1) }
}
console.log(`우연(1~10라운드) ${pct(chance(0, 10))}% · (1~20) ${pct(chance(0, 20))}%`)
console.log('| 유형 | 두 번째 판 1~10R 사전값 없음 | 있음 | 차이 (95% CI) | 1~20R 없음 → 있음 |')
console.log('|---|---|---|---|---|')
const row = (name, r) => console.log(`| ${name} | ${pct(r.e0)}% | ${pct(r.e1)}% | ${r.de >= 0 ? '+' : ''}${pct(r.de)}%p (±${pct(r.dci)}) | ${pct(r.f0)} → ${pct(r.f1)}% |`)
for (const [id, bot] of Object.entries(BOTS)) row(bot.name, pairs(bot, bot))
row('스타일 바꿈: 편향 A → 편향 B', pairs(BOTS.biased, BOTS.biased, (me) => ({ fav: TAGS[(TAGS.indexOf(me.fav) + 1) % 4] })))
row('스타일 바꿈: 반복 → 무작위', pairs(BOTS.repeat, BOTS.random))
row('스타일 바꿈: 첫 버튼 → 무작위', pairs(BOTS.firstButton, BOTS.random))
