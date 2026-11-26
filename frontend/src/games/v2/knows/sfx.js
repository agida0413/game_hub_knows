// 효과음 — WebAudio 로 그 자리에서 합성 (소리 파일 없음 · 생성 비용 0)
//   tap: '아니' 누를 때 아주 짧은 나무 소리 · slip: 잘못 누르거나 늦었을 때 낮은 둔음 · sting: 공개 결과(들킴 = 낮게 내려감, 숨김 = 밝게 올라감)
let ctx = null

function ac() {
  try {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext
      if (!C) return null
      ctx = new C()
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    return ctx
  } catch { return null }
}

function tone(c, { f0, f1 = f0, type = 'sine', dur = 0.12, vol = 0.12, at = 0 }) {
  const t = c.currentTime + at
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  g.connect(c.destination)
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  o.connect(g)
  o.start(t)
  o.stop(t + dur + 0.02)
}

export function tap(on = true) {
  if (!on) return
  const c = ac()
  if (c) try { tone(c, { f0: 1400, f1: 900, type: 'triangle', dur: 0.05, vol: 0.05 }) } catch { /* 소리 없음 */ }
}

export function slip(on = true) {
  if (!on) return
  const c = ac()
  if (c) try { tone(c, { f0: 140, f1: 90, type: 'square', dur: 0.18, vol: 0.06 }) } catch { /* 소리 없음 */ }
}

export function sting(on = true, caught = true) {
  if (!on) return
  const c = ac()
  if (!c) return
  try {
    const notes = caught ? [523, 415, 311] : [392, 523, 659]
    notes.forEach((f, i) => tone(c, { f0: f, type: 'sine', dur: 0.5, vol: 0.09, at: i * 0.12 }))
  } catch { /* 소리 없음 */ }
}
