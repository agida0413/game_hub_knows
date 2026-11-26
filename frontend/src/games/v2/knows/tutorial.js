// AI KNOWS YOU 첫 판 안내 대본 — react 없음 (node --test 로 시험). 형식은 설계서 2-3 단계 정의 형식 그대로.
//   짚을 자리 이름(at)은 Proto.jsx 의 data-onb 와 같다. 문장은 15자 이내 · 기호 없음.
//   연습 두 칸은 화면만의 상태다 — 판정 · 반응 기록(trials)에 들어가지 않고, 엔진(game.js · engine.js)은 그대로.
export const TUTORIAL = {
  game: 'knows',
  version: 2,
  steps: [
    { id: 'pick', at: 'picked', line: '마음속으로 하나 정해요', icon: 'EyeOff', until: 'picked', when: 'show' },
    { id: 'no', at: 'no', line: '숨긴 사진이 나와도 아니', icon: 'Eye', until: 'press_no', when: 'practice' },
    { id: 'yes', at: 'yes', line: '테두리가 있으면 예', icon: 'Square', until: 'press_yes', when: 'practice' },
    { id: 'run', at: null, line: '빠르게, 끝까지 아니', icon: 'Gauge', until: 'reveal', when: 'run' },
    { id: 'late', at: 'bars', line: '손이 늦은 사진이 들켜요', icon: 'Eye', until: 'next', when: 'done' },
  ],
}

// 연습 두 칸의 사진 두 장 — 그 라운드 사진 중 앞 두 장(서로 다른 두 장). 첫 장은 테두리 없음(아니), 둘째는 테두리 있음(예).
//   st 는 game.js 의 상태(rounds · round) — 판정과 무관하고 아무것도 저장하지 않는다.
export function practicePair(items) {
  const list = Array.isArray(items) ? items : []
  if (list.length < 2) return null
  return [
    { item: list[0], target: false, kind: 'no' },
    { item: list[1], target: true, kind: 'yes' },
  ]
}

// 연습을 보일지 — 첫 판(기록에 판 없음) 첫 라운드, 사다리 판(오늘의 판 아님)
export function showPractice({ plays, round, daily }) {
  return plays === 0 && round === 0 && !daily
}
