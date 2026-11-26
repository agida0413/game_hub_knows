// 「숨긴 사진」 인구 혼합 단계 곡선 — 사람 유형을 섞어(없음 25 · 작은 늦음 35 · 큰 늦음 25 · 일부러 늦춤 10 · 작은 늦음+속임 5)
//   단계마다 한 판 돌파율이 완만하게 내려가는지, 신호가 있는 사람의 높은 단계 돌파율이 0 이 아닌지 시뮬레이션으로 고정한다
//   (보고서의 큰 표본 숫자는 sim 으로 따로 쟀다 — 여기는 작은 표본이라 허용 폭을 넓게 잡았다)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { STAGES } from '../src/games/v2/knows/ladder.js'
import { simulateGames } from '../src/games/v2/knows/sim.js'

const MIX = { none: 25, small: 35, tell: 25, randomSlow: 10, smallDeceive: 5 }
const N = 90

function mixAt(stage) {
  let clear = 0
  const per = {}
  for (const [k, w] of Object.entries(MIX)) {
    const g = simulateGames(k, N, 500 + stage, STAGES[stage - 1])
    per[k] = g.clear
    clear += (g.clear * w) / 100
  }
  return { clear, per }
}

test('인구 혼합 돌파율 — 1단계는 대부분 깨고 · 단계가 오르면 내려가고 · 10단계도 0 이 아니다', () => {
  const rows = Object.fromEntries([1, 4, 7, 9, 10].map((s) => [s, mixAt(s)]))
  const c = (s) => rows[s].clear
  assert.ok(c(1) >= 0.6 && c(1) <= 0.85, `1단계 ${c(1).toFixed(2)}`)
  assert.ok(c(10) >= 0.35 && c(10) <= 0.62, `10단계 ${c(10).toFixed(2)}`)
  assert.ok(c(1) - c(10) >= 0.1, '위 단계가 확실히 더 어렵다')
  for (const [a, b] of [[1, 4], [4, 7], [7, 10]]) assert.ok(c(b) <= c(a) + 0.07, `${a}단계 ${c(a).toFixed(2)} -> ${b}단계 ${c(b).toFixed(2)}`)
  // 반응 시간 신호가 큰 사람의 돌파율은 높은 단계에서 거의 없지만 0 은 아니다(9단계는 3라운드)
  assert.ok(rows[1].per.tell >= 0.3, `1단계 큰 늦음 ${rows[1].per.tell}`)
  assert.ok(rows[9].per.tell <= 0.25, `9단계 큰 늦음 ${rows[9].per.tell}`)
  // 신호가 없는 사람은 어느 단계든 대부분 깬다(우연 20% 근처)
  for (const s of [1, 4, 7, 9, 10]) assert.ok(rows[s].per.none >= 0.8, `${s}단계 신호 없음 ${rows[s].per.none}`)
})
