// 「숨긴 사진」 운영 지표 이름 — 순수 함수 (react · 네트워크 없음). 개인정보와 반응 시간 원자료는 만들지도 보내지도 않는다
//   서버는 기존 game_stats 의 A/B 이름 규칙(ab<번호>_<갈래>_<값>, 영 소문자·숫자 12자 이내)을 그대로 쓴다. 새 서버 이벤트는 없다
//   ab30_s<단계>r<라운드>_<hit|miss>[sig]  한 라운드 AI 적중 여부. 끝에 sig 가 붙으면 그 라운드에 손가락 신호 학습이 켜져 있었다
//                                           단계 0 = 오늘의 판. 이것으로 운영 단계별 AI 적중률 · 신호 학습 비율을 센다(이름 개수 = 단계 11 x 라운드 5 x 4)
//   ab34_<세트><번호>_g                      AI 가 그 사진을 골랐다   ab35_<세트><번호>_r  그 사진이 진짜 숨긴 사진이었다
//                                           사진별로 둘의 비율을 비교하면 사진 고유의 느림(사진별 보정이 필요한지)이 보인다
const isAbLabel = (s) => /^ab[0-9]{1,2}_[a-z0-9]{1,12}_[a-z0-9]{1,12}$/.test(s)   // analytics.js · 서버 game_stats.py 와 같은 모양(그 파일은 네트워크를 불러 순수 시험에 못 쓴다)

export const AB_ROUND = 'ab30'
export const AB_GUESS = 'ab34'
export const AB_REAL = 'ab35'

// 한 라운드가 끝났을 때 보낼 이름들 — st: 라운드 끝('done') 상태, st.view.sigOn: 그 라운드 판정에 손가락 신호 학습이 켜져 있었나
export function roundLabels(st) {
  const r = st.results[st.results.length - 1]
  if (!r) return []
  const stage = Math.max(0, st.stage | 0)
  const out = [`${AB_ROUND}_s${stage}r${st.round + 1}_${r.hit ? 'hit' : 'miss'}${st.view && st.view.sigOn ? 'sig' : ''}`]
  const guessItem = st.rounds[st.round].items[r.guess]
  out.push(`${AB_GUESS}_${r.set}${guessItem}_g`, `${AB_REAL}_${r.set}${r.item}_r`)
  return out.filter(isAbLabel)
}
