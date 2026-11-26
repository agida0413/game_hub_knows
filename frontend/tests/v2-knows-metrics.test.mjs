// 「숨긴 사진」 운영 지표 이름 — 서버 규칙에 맞는 모양 · 개인정보 없음 · 모든 단계 · 라운드 · 세트 조합
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { roundLabels } from '../src/games/v2/knows/metrics.js'
import { init } from '../src/games/v2/knows/game.js'
import { STAGES } from '../src/games/v2/knows/ladder.js'
import { SETS } from '../src/games/v2/knows/sets.js'

const AB = /^ab[0-9]{1,2}_[a-z0-9]{1,12}_[a-z0-9]{1,12}$/   // 서버 game_stats.py AB_LABEL 과 같다

function doneState(stage, round, hit, sigOn, setId, real = 1, guess = hit ? 1 : 2) {
  const st = init(7, { stage, best: 9 })
  const rounds = st.rounds.map((r, i) => (i === round ? { ...r, set: setId, items: [3, 0, 4, 6, 5, 1, 2].slice(0, st.cfg.n) } : r))
  return { ...st, rounds, stage: st.stage, round, view: { sigOn }, results: [{ set: setId, item: rounds[round].items[real], real, guess, hit }] }
}

test('라운드 지표 이름 — 단계 · 라운드 · 적중 · 신호 학습, 사진별 선택 · 진짜', () => {
  const st = doneState(3, 0, true, false, 'thing')
  assert.deepEqual(roundLabels(st), ['ab30_s3r1_hit', 'ab34_thing0_g', 'ab35_thing0_r'])
  const m = doneState(10, 2, false, true, 'nature', 3, 1)
  assert.deepEqual(roundLabels(m).slice(0, 1), ['ab30_s10r3_misssig'])
  assert.deepEqual(roundLabels({ ...st, results: [] }), [])
})

test('모든 단계 · 라운드 · 세트 · 사진 번호 조합이 서버 이름 규칙을 지킨다 (원자료 · 개인 값 없음)', () => {
  let n = 0
  for (const s of [{ stage: 0 }, ...STAGES]) {
    const rounds = s.rounds || 3   // 단계 값의 라운드 수(오늘의 판은 3)
    for (let r = 0; r < rounds; r++) {
      for (const set of SETS) for (const hit of [true, false]) for (const sig of [true, false]) {
        const st = { ...doneState(Math.max(1, s.stage), r % 3, hit, sig, set.id), stage: s.stage, round: r }
        const labels = roundLabels(st)
        assert.equal(labels.length, 3)
        for (const l of labels) { assert.match(l, AB, l); n++ }
        assert.ok(!/\d{3,}/.test(labels[0]), '시간 같은 긴 숫자 없음')
      }
    }
  }
  assert.ok(n > 1000)
})
