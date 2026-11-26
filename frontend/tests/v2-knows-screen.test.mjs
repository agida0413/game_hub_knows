// 「AI KNOWS YOU · 숨긴 사진」 화면 — 360x640 에서 깨지던 것들 (11/25 전체 시험에서 운영 사이트로 잰 값)
//   화면(Proto.jsx)은 react 라 node 로 그릴 수 없어 CSS · JSX 원문을 읽어 규칙을 확인한다
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const proto = readFileSync(new URL('../src/games/v2/knows/Proto.jsx', import.meta.url), 'utf8')
const css = (proto.match(/const CSS = `([\s\S]*?)`/) || [])[1] || ''
const base = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8')

test('공개 화면 근거 막대 — 공용 button:disabled 흐림(0.45)을 덮는다 (막대 줄은 진짜 고르기 때만 눌리는 버튼이라 공개 · 결과 때 흐려졌다)', () => {
  assert.ok(css.length > 1000, 'Proto.jsx 의 CSS 를 찾지 못함')
  // 공용 규칙이 그대로 있는 한, 막대 줄 규칙이 opacity 1 로 덮어야 한다
  assert.match(base, /button:disabled\s*\{[^}]*opacity:\s*0?\.45/)
  const row = css.match(/button\.kv-row:disabled\{([^}]*)\}/)
  assert.ok(row, 'button.kv-row:disabled 규칙 없음')
  assert.match(row[1], /opacity:1/)
  // 막대 줄은 지금도 disabled 로 공개 · 결과 때 막는다(요소를 바꾸면 막대 애니메이션이 처음부터 다시 돈다)
  assert.ok(proto.includes("disabled={st.phase !== 'pick'}"))
})

// 고치기 전 운영(360x640): 빠른 진행 '예' 593~679 · 공개 '맞아요 / 아니, 이거' 616~708 · 라운드 결과 '다음' 589~682 ·
//   연습 '예' 615~663 · 첫 판 '골랐어요' 589~645 — 화면(640) 밖이라 굴려야 보였다. '예'는 테두리 사진이 뜨면 1초 안에 눌러야 한다
test('낮은 화면(360x640) — 빠른 진행 사진 칸은 화면 높이에 맞춰 줄고, 단추는 44px 이상 그대로', () => {
  // 사진 칸: 폭 = min(90vw, 360px, 100dvh - 나머지 높이). dvh 를 모르는 옛 브라우저는 @supports 밖의 옛 값 그대로
  assert.match(css, /\.kv-frame\{position:relative;width:min\(90vw,360px\)/)
  // 가로로 든 휴대폰(높이 약 360)에서 사진이 46px 로 쪼그라들지 않게 바닥 200px (그때는 예전처럼 굴려서 본다)
  assert.match(css, /@supports \(height:100dvh\)\{\.kv-frame\{width:min\(90vw,360px,max\(200px,calc\(100dvh - var\(--fr\)\)\)\)\}\}/)
  const fr = (sel, block = css) => Number((block.match(new RegExp(sel.replace(/[.[\]()=]/g, (c) => '\\' + c) + '\\{--fr:(\\d+)px\\}')) || [])[1])
  const low = (css.match(/@media \(max-height:760px\)\{([\s\S]*?)\n\}/) || [])[1] || ''
  assert.ok(low, '낮은 화면 규칙 없음')
  for (const block of [css, low]) {
    const b = fr('.kv-frame', block)
    const co = fr('.kv.co .kv-frame', block)
    const pr = fr('.kv[data-phase=practice] .kv-frame', block)
    assert.ok(b > 250 && co > b && pr > b, `--fr ${b} ${co} ${pr}`)   // 안내 줄(코치)이 뜨면 그만큼 더 뺀다
    // 640 높이에서 사진 칸이 너무 작아지지 않게(빠른 진행에서 한눈에 알아봐야 한다)
    if (block === low) assert.ok(640 - co >= 260 && 640 - b >= 300, `640 에서 사진 ${640 - b} · 안내 줄 있을 때 ${640 - co}`)
  }
  // 단추 크기 — 낮은 화면에서도 '아니'는 크게(엄지로 빠르게), 막대 줄(진짜 고르기 단추)은 44px 이상
  const noH = Number((low.match(/\.kv-no\{min-height:(\d+)px\}/) || [])[1])
  assert.ok(noH >= 72, `'아니' ${noH}px`)
  assert.match(low, /\.kv-row\{min-height:44px/)
  assert.ok(!/\.kv-yes\{/.test(low), "'예' 크기는 그대로(48px)")
  assert.match(css, /\.kv-yes\{min-width:120px;min-height:48px/)
  // 공개 화면: 봉투를 줄여(사진 7장은 더) '맞아요 / 아니, 이거'가 화면 안에
  assert.match(low, /\.kv-env,\.kv\.cmp \.kv-env\{transform:scale\(\.72\)/)
  const cmpScale = Number((low.match(/\.kv\.cmp \.kv-env\{transform:scale\(([\d.]+)\);margin-bottom:-(\d+)px\}/) || [])[1])
  const cmpMb = Number((low.match(/\.kv\.cmp \.kv-env\{transform:scale\([\d.]+\);margin-bottom:-(\d+)px\}/) || [])[1])
  assert.ok(cmpScale >= 0.4 && cmpScale < 0.72, `7장 봉투 ${cmpScale}`)
  assert.ok(Math.abs(cmpMb - Math.round(196 * (1 - cmpScale))) <= 1, `줄인 만큼 아래 여백도 당긴다: ${cmpMb}`)
  // 화면: 빠른 진행에 안내 줄이 뜨면 main 에 co · 사진 보기 격자는 안내 줄 높이만큼 덜 쓴다
  assert.ok(proto.includes("const coachOn = !!(coach.view && coach.view.kind === 'step')"))
  assert.ok(proto.includes("className={'kv' + cmp + (coachOn ? ' co' : '')} data-phase=\"run\""))
  assert.ok(proto.includes('(isNew ? 236 : 200) + (coachOn ? 32 : 0)'))
})

test("첫 판 안내 — '빠르게, 끝까지 아니'(when: run)가 공개 때 끝나고 다음 단계 '손이 늦은 사진이 들켜요'가 라운드 결과에 뜬다", async () => {
  const { coachInit, coachReduce, coachView } = await import('../src/onboarding/coach.js')
  const { TUTORIAL: t } = await import('../src/games/v2/knows/tutorial.js')
  const play = (emitFirst) => {
    let cs = coachInit(t, { show: true })
    const R = (a) => { cs = coachReduce(cs, t, { now: 1, ...a }) }
    R({ type: 'state', name: 'show' }); R({ type: 'emit', name: 'picked' })
    R({ type: 'state', name: 'practice' }); R({ type: 'emit', name: 'press_no' }); R({ type: 'emit', name: 'press_yes' })
    R({ type: 'state', name: 'run' })
    assert.equal(coachView(cs, t, 'run').id, 'run')
    // 공개 화면으로 바뀌는 순간: 화면의 emit('reveal') 과 useCoach 의 상태 'other'(공개는 안내 상태가 아님) 중 무엇이 먼저 닿나
    if (emitFirst) { R({ type: 'emit', name: 'reveal' }); R({ type: 'state', name: 'other' }) } else { R({ type: 'state', name: 'other' }); R({ type: 'emit', name: 'reveal' }) }
    R({ type: 'state', name: 'done' })
    return coachView(cs, t, 'done')
  }
  assert.equal(play(false), null, '상태가 먼저면 emit 이 버려진다(고치기 전 — 첫 세션 내내 run 단계에 멈춤)')
  assert.equal(play(true).id, 'late')
  // 그래서 화면은 useLayoutEffect 로 보낸다(useCoach 의 상태 useEffect 보다 먼저)
  assert.ok(proto.includes("useLayoutEffect(() => { if (st.phase === 'reveal') coach.emit('reveal') }, [st.phase])"))
  assert.ok(!proto.includes("useEffect(() => { if (st.phase === 'reveal') coach.emit('reveal') }"))
  // 라운드 결과에 안내 줄이 뜨면(co) 낮은 화면에서 설명 줄을 숨기고 봉투를 더 줄인다(사진 7장은 봉투를 숨긴다) — [다음]이 화면 안에
  const low = (css.match(/@media \(max-height:760px\)\{([\s\S]*?)\n\}/) || [])[1] || ''
  assert.match(low, /\.kv\.co \.kv-cap\{display:none\}/)
  assert.match(low, /\.kv\.co \.kv-env\{transform:scale\(\.5\);margin-bottom:-98px\}/)
  assert.match(low, /\.kv\.cmp\.co \.kv-env\{display:none\}/)
  assert.ok(proto.includes("<main className={'kv' + cmp + (coachOn ? ' co' : '')} data-phase={st.phase}>"))
})

test("표지 음악 단추 — 왼쪽 위(허브 '홈' 단추 자리)에 두지 않는다 · '?' 옆 오른쪽", () => {
  const hub = readFileSync(new URL('../src/hub/hubback.css', import.meta.url), 'utf8')
  assert.match(hub, /\.hubback\s*\{[^}]*position:\s*fixed[^}]*left:/)   // 홈 단추는 모든 게임 왼쪽 위에 고정
  const btn = proto.match(/<button[^>]*data-act="music"[^>]*>/)
  assert.ok(btn, '표지 음악 단추 없음')
  assert.ok(!/left:\s*\d/.test(btn[0]), btn[0])
  const right = Number((btn[0].match(/right:\s*(\d+)/) || [])[1])
  assert.ok(right >= 10 + 44 + 4, `'?'(오른쪽 10px · 44px)와 겹침: right ${right}`)
})
