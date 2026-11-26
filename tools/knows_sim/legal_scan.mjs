// 공개 전 법적 검토 — 화면에 나오는 모든 한국어 글을 모아 금지 목록과 대조하고, 전체 목록을 출력한다
//   node tools/knows_sim/legal_scan.mjs  (사람이 목록을 눈으로도 본다)
import fs from 'node:fs'
const files = ['situations.js', 'lines.js', 'KnowsGame.jsx', 'card.js'].map((f) => `frontend/src/games/knows/${f}`)
const strings = []
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('{/*'))
  for (const line of src) {
    for (const m of line.matchAll(/(['"`])((?:(?!\1).)*[가-힣](?:(?!\1).)*)\1/g)) strings.push({ f: f.split('/').pop(), s: m[2] })
    for (const m of line.matchAll(/>([^<>{}]*[가-힣][^<>{}]*)</g)) strings.push({ f: f.split('/').pop(), s: m[1].trim() })
  }
}
// 실존 상표 · 서비스 · 회사 (단체방 AI 대화의 목록 + 이 게임에 나올 법한 것)
const REAL = ['카카오', '카톡', '네이버', '텔레그램', '인스타', '페이스북', '유튜브', '삼성', '애플', '아이폰', '갤럭시', '구글', '디스코드', '트위터', '틱톡', '쿠팡', '배민', '당근', '토스', '넷플릭스', '스타벅스', 'MBTI', '로또', '복권', '코인']
// 심리 진단 · 지능 측정으로 오해될 말 — 고지 문구('심리 진단이 아닙니다' · '심리 진단 아님')만 허용
const DIAG = ['진단', '성격', '지능', 'IQ', '장애', '정신', '우울', '불안', '검사', '치료', '증상', '심리 유형']
const ALLOW = [/심리 진단이 아닙니다/, /심리 진단 아님/]
const hits = []
for (const x of strings) {
  for (const w of [...REAL, ...DIAG]) {
    if (x.s.includes(w) && !ALLOW.some((a) => a.test(x.s))) hits.push(`${x.f}: '${x.s}' ← ${w}`)
  }
}
const uniq = [...new Set(strings.map((x) => `${x.f}\t${x.s}`))]
console.log(`글 ${uniq.length}개 검사 · 걸린 것 ${hits.length}`)
for (const h of hits) console.log('  ✕', h)
if (process.argv.includes('--list')) for (const u of uniq) console.log(u)
