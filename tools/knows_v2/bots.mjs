// 마술 3 · 4 · 5 시뮬레이션용 가상 플레이어 — 봇은 봉인 내용을 볼 수 없다 (공개된 미끼 · 자기 지난 선택만 안다)
const ri = (r, n) => Math.floor(r() * n)
const other = (r, n, not) => { let x = ri(r, n - 1); return x >= not ? x + 1 : x }
const cardRandom = (r) => { const f = ri(r, 3); return { first: f, final: r() < 0.6 ? f : ri(r, 3), dwell: [0, 0, 0] } }
const base = { first: (r) => ri(r, 4), card: cardRandom, decoy: (plan, r) => ri(r, 3), rhythm: (h, r) => ri(r, 3) }
export const BOTS = {
  random: { name: '완전 무작위', ...base },
  left: { name: '왼쪽 70% 편향', ...base, first: (r) => (r() < 0.7 ? 0 : ri(r, 4)),
    card: (r) => { const f = r() < 0.7 ? 0 : ri(r, 3); return { first: f, final: f, dwell: [0, 0, 0] } },
    rhythm: (h, r) => (r() < 0.7 ? 0 : ri(r, 3)) },
  repeat: { name: '직전과 같은 쪽 85%', ...base,
    rhythm: ({ choices }, r) => (choices.length && r() < 0.85 ? choices[choices.length - 1] : ri(r, 3)) },
  cycle: { name: '순환 ▲●■', ...base, rhythm: (h, r, i) => i % 3 },
  alternate: { name: '교대 (두 칸)', ...base, rhythm: (h, r, i) => (i % 2 ? 2 : 0) },
  avoider: { name: '미끼를 피함(처음 닿은 카드로)', ...base,
    card: (r) => { const f = ri(r, 3); const g = r() < 0.5 ? f : other(r, 3, f); return { first: f, final: g, dwell: [0, 0, 0] } },
    decoy: (plan, r, { t }) => (t.first !== plan.decoy ? t.first : other(r, 3, plan.decoy)),
    rhythm: (h, r) => ri(r, 3) },
  biter: { name: '미끼를 그대로 고름', ...base, decoy: (plan) => plan.decoy },
  popular: { name: '흔한 쪽(3번·가운데)을 고름', ...base, first: (r) => (r() < 0.6 ? 2 : ri(r, 4)),
    card: (r) => { const f = r() < 0.6 ? 1 : ri(r, 3); return { first: f, final: f, dwell: [0, 0, 0] } } },
  mixed: { name: '사람 같은 혼합(반복 50%·무작위)', ...base,
    rhythm: ({ choices }, r) => (choices.length && r() < 0.5 ? choices[choices.length - 1] : ri(r, 3)) },
}
