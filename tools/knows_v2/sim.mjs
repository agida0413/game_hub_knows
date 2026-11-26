// 마술 3 · 4 · 5 적중 시뮬레이션 — node tools/knows_v2/sim.mjs [판 수=600]
//   표: 마술별 AI 적중% (우연 기준선 옆에), 예언 발행 % · 맞음 %. LLM · 네트워크 없음, 같은 인자면 같은 결과
import { runGame } from '../../frontend/src/games/v2/knows/logic.js'
import { BOTS } from './bots.mjs'
const G = Number(process.argv[2] || 600)
const pct = (x) => (x * 100).toFixed(1)
console.log(`판 ${G}씩 · 우연: 마술2 33.3% · 마술3 33.3% · 마술4(10번 중 5번 이상) 우연형 약 21% · 평균 적중 33.3%`)
console.log('| 유형 | 마술1 | 마술2 | 마술3 | 마술4 적중 | 마술4 5번↑ | 마술5 발행 | 마술5 맞음(발행 중) | 평균 AI 점수 | 맞음/발행 (예언 · 작은 예고) |')
console.log('|---|---|---|---|---|---|---|---|---|---|')
for (const [id, bot] of Object.entries(BOTS)) {
  const s = { m1: 0, m2: 0, m3: 0, h: 0, w4: 0, iss: 0, held: 0, ai: 0 }
  for (let g = 0; g < G; g++) {
    const o = runGame(bot, 1 + g * 7919)
    s.m1 += o.results[0]; s.m2 += o.results[1]; s.m3 += o.results[2]; s.h += o.m4.hits; s.w4 += o.results[3]
    s.iss += o.m5.issued; if (o.m5.kind) { s['k_'+o.m5.kind] = (s['k_'+o.m5.kind]||0)+1; s['h_'+o.m5.kind] = (s['h_'+o.m5.kind]||0)+(o.m5.held===true) } s.held += o.m5.held === true; s.ai += o.score.ai
  }
  console.log(`| ${bot.name} (${id}) | ${pct(s.m1 / G)}% | ${pct(s.m2 / G)}% | ${pct(s.m3 / G)}% | ${(s.h / G).toFixed(2)}/10 (${pct(s.h / G / 10)}%) | ${pct(s.w4 / G)}% | ${pct(s.iss / G)}% | ${s.iss ? pct(s.held / s.iss) + '%' : '-'} | ${(s.ai / G).toFixed(2)} | 예언 ${s.h_main||0}/${s.k_main||0} · 작은 예고 ${s.h_small||0}/${s.k_small||0} |`)
}
