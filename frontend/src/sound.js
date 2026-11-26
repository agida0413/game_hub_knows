// 소리 엔진 — 배경음 · 환경음 · 효과음 · 목소리 (Web Audio API)
//   브라우저 정책상 첫 사용자 입력(클릭·키) 이후에만 소리가 난다 → unlock() / keepAlive()
//
//   믹서:  음악(music) ─ 덕킹 ─┐
//          환경음(amb) ─ 덕킹 ─┼─ 마스터(볼륨) ─ 리미터 ─ 스피커
//          효과음(sfx) · 목소리(voice) ┘
//   음악   ① 사건 전용 곡(case.music — Lyria 로 사건마다 만든 약 2분 연주곡) ② 분위기별 공용 곡(/api/cast 의 sound —
//          30초 곡 여러 벌을 교차 반복) ③ 합성 음악 순으로. 음원은 모두 미디어 저장소(S3) → /api/media/{id}
//   환경음 장면별 층 — 법정(실내 잡음 · 종이 · 의자 · 기침) · 비 · 스릴러(초침 · 심장) · 공포(저음 · 바람 · 속삭임 · 삐걱임 …)
//   연출음 sting('scare' | 'twist' | 'lie' | 'win' | 'lose') — 생성 음원, 없으면 합성
//   공포 연출 세기는 설정(scare: full · soft · off) — '심약자 주의' 사건에서 깜짝 효과 · 속삭임을 줄이거나 끈다
import { getSettings } from './storage.js'

let ctx = null
let bus = null          // { master, music, musicDuck, amb, ambDuck, sfx, voice }
let settings = getSettings()
window.addEventListener('mg:settings', (e) => {
  settings = { ...getSettings(), ...e.detail }
  applyLevels()
  if (!settings.ambient) stopScene()
  else if (ctx) refreshScene(1.5)
})

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    const g = (to) => {
      const n = ctx.createGain()
      n.connect(to)
      return n
    }
    // 마지막에 리미터 — 연출음이 겹쳐도 찢어지지 않게
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -6
    limiter.knee.value = 4
    limiter.ratio.value = 12
    limiter.attack.value = 0.003
    limiter.release.value = 0.25
    limiter.connect(ctx.destination)
    const master = g(limiter)
    const musicDuck = g(master)
    const ambDuck = g(master)
    bus = { master, musicDuck, ambDuck, music: g(musicDuck), amb: g(ambDuck), sfx: g(master), voice: g(master) }
    applyLevels()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function applyLevels() {
  if (!bus) return
  const t = ctx.currentTime
  bus.master.gain.setTargetAtTime(settings.volume, t, 0.05)
  bus.music.gain.setTargetAtTime(settings.ambient ? (settings.bgmVolume ?? 0.7) : 0.0001, t, 0.1)
  bus.amb.gain.setTargetAtTime(settings.ambient ? 1 : 0.0001, t, 0.1)
}

export function unlock() {
  const c = ac()
  if (!c) return
  // iOS: 입력 이벤트 안에서 소리를 한 번 내야 이후 예약한 소리가 난다 (무음 1샘플)
  try {
    const b = c.createBuffer(1, 1, c.sampleRate)
    const s = c.createBufferSource()
    s.buffer = b
    s.connect(c.destination)
    s.start()
  } catch { /* 무시 */ }
  iosPlayback()
  manifest()
  if (settings.ambient) refreshScene(3)
}

// iOS 무음 스위치가 켜져 있어도 소리가 나게 — 오디오 세션을 '재생'으로 (사파리 17+), 옛 iOS 는 무음 <audio> 를
//   입력 이벤트 안에서 반복 재생해 같은 효과를 낸다 (unmute 기법). 한 번만
let iosDone = false
function iosPlayback() {
  if (iosDone || typeof navigator === 'undefined') return
  iosDone = true
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback'
  } catch { /* 무시 */ }
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!ios || navigator.audioSession || typeof document.createElement !== 'function') return
  try {
    const el = document.createElement('audio')
    el.setAttribute('x-webkit-airplay', 'deny')
    el.disableRemotePlayback = true
    el.preload = 'auto'
    el.loop = true
    el.src = silentWav()
    el.play()?.catch?.(() => {})
  } catch { /* 무시 */ }
}
function silentWav() {
  // 8kHz · 8bit · 0.1초 무음 WAV (data URI)
  const n = 800
  const b = new Uint8Array(44 + n)
  const v = new DataView(b.buffer)
  const s = (o, t) => [...t].forEach((ch, i) => (b[o + i] = ch.charCodeAt(0)))
  s(0, 'RIFF'); v.setUint32(4, 36 + n, true); s(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true)
  v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true)
  v.setUint16(34, 8, true); s(36, 'data'); v.setUint32(40, n, true)
  b.fill(128, 44)
  let bin = ''
  b.forEach((x) => (bin += String.fromCharCode(x)))
  return 'data:audio/wav;base64,' + btoa(bin)
}

// 배경음이 '저절로 꺼지는' 경우 — 탭을 옮기거나 휴대폰 알림 · 통화 · 다른 앱 소리로 오디오가 멈춤(suspended · interrupted)
// 되면 다음 소리가 날 때까지 조용했다. 화면을 누를 때마다 · 화면으로 돌아올 때 다시 깨운다 (새로고침 뒤에는 첫 입력에서)
export function keepAlive() {
  const wake = () => {
    if (!ctx) return unlock()
    if (ctx.state !== 'running') ctx.resume().catch(() => {})
    if (settings.ambient && (!musicNow || !ambNow)) refreshScene(2)
  }
  window.addEventListener('pointerdown', wake, { passive: true })
  window.addEventListener('keydown', wake)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx) wake()
  })
  return () => {
    window.removeEventListener('pointerdown', wake)
    window.removeEventListener('keydown', wake)
  }
}

// ------------------------------------------------------------------ 덕킹 — 시네마틱 · 대사 · 연출음 동안 배경을 내린다
//   여러 곳에서 동시에 내려도 가장 낮은 값이 적용되고, 모두 풀려야 원래대로
const ducks = new Map()
let duckSeq = 0
function applyDucks(tc) {
  if (!bus) return
  let m = 1
  let a = 1
  ducks.forEach((d) => {
    m = Math.min(m, d.m)
    a = Math.min(a, d.a)
  })
  const t = ctx.currentTime
  bus.musicDuck.gain.cancelScheduledValues(t)
  bus.musicDuck.gain.setTargetAtTime(Math.max(0.0001, m), t, tc)
  bus.ambDuck.gain.cancelScheduledValues(t)
  bus.ambDuck.gain.setTargetAtTime(Math.max(0.0001, a), t, tc)
}
function addDuck(m, a = m, tc = 0.12) {
  const id = ++duckSeq
  ducks.set(id, { m, a })
  applyDucks(tc)
  return (release = 0.8) => {
    if (ducks.delete(id)) applyDucks(release)
  }
}
export function duckBgm() {
  if (!ac()) return () => {}
  const release = addDuck(0.0001, 0.0001)
  return () => release(0.8)
}

// ------------------------------------------------------------------ 공용 음원 목록 — /api/cast 의 sound {'bgm/horror-1': '/api/media/…'}
//   첫 입력(unlock) 때 받는다 — 받기 전 · 실패하면 전부 합성 소리로
let manifestP = null
let manifestCached = null
//   bgm/<분위기>-N · sting/<이름> · whisper/wN · voice/<이름> · amb/<이름> · sfx/<세트>/<소리>-N
export function soundManifest(sound) {
  const m = { bgm: {}, sting: {}, stingAlt: {}, whisper: [], voice: {}, amb: {}, sfx: {} }
  Object.keys(sound || {}).sort().forEach((key) => {
    const [kind, name, sub] = key.split('/')
    const src = sound[key]
    if (!name || typeof src !== 'string') return
    if (kind === 'bgm') {
      const mood = name.replace(/-\d+$/, '')
      m.bgm[mood] = (m.bgm[mood] || []).concat(src)
    } else if (kind === 'sting') {
      // 같은 연출음의 변주 (scare-1 · scare-2 …) — 번호 붙은 것이 있으면 그것들만 번갈아, 없으면 이름 하나
      const base = name.replace(/-\d+$/, '')
      if (base !== name) m.stingAlt[base] = (m.stingAlt[base] || []).concat(src)
      else m.sting[name] = src
    } else if (kind === 'whisper') m.whisper.push(src)
    else if (kind === 'voice') m.voice[name] = src
    else if (kind === 'amb') m.amb[name] = src
    else if (kind === 'sfx' && sub) {
      const label = sub.replace(/-\d+$/, '')
      const set = (m.sfx[name] = m.sfx[name] || {})
      set[label] = (set[label] || []).concat(src)
    }
  })
  Object.entries(m.stingAlt).forEach(([base, list]) => (m.sting[base] = list[0]))
  return m
}
// 연출음 음원 후보 — 변주가 있으면 전부, 아니면 하나
const stingPaths = (name) => manifestCached?.stingAlt?.[name] || (manifestCached?.sting?.[name] ? [manifestCached.sting[name]] : [])
function loadSting(name) {
  stingPaths(name).forEach((p) => loadBuffer(p, 'sting'))
}

// 효과음 세트의 소리 하나 (같은 소리 여러 벌 중 하나) — 받아 둔 것만 바로, 아니면 받기 시작하고 false (호출 쪽이 합성으로)
function sample(set, label, opts = {}) {
  const list = manifestCached?.sfx?.[set]?.[label]
  if (!list?.length || !ac()) return false
  const ready = list.filter((p) => cached(p))
  if (ready.length < list.length) list.forEach((p) => loadBuffer(p, 'sfx'))
  if (!ready.length) return false
  playBuffer(cached(pick(ready)), { out: bus.sfx, ...opts })
  return true
}
const hasSample = (set, label) => !!manifestCached?.sfx?.[set]?.[label]?.length
function preloadSet(set) {
  Object.values(manifestCached?.sfx?.[set] || {}).forEach((list) => list.forEach((p) => loadBuffer(p, 'sfx')))
}
function manifest() {
  if (!manifestP) {
    manifestP = fetch('/api/cast')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => soundManifest(d?.cast?.sound))
      .catch(() => null)
      .then((m) => (manifestCached = m))
  }
  return manifestP
}

// 음량 맞추기 — 생성 곡마다 크기가 달라 RMS 로 맞추고, 앞뒤 무음과 '가장 센 타격' 위치를 기록해 둔다
function analyse(buf, kind) {
  const ch = buf.getChannelData(0)
  const sr = buf.sampleRate
  const win = Math.floor(sr * 0.05)
  let sum = 0
  let n = 0
  let first = -1
  let last = 0
  let hit = 0
  let prev = 0
  let jump = 0
  for (let i = 0; i + win <= ch.length; i += win) {
    let s = 0
    for (let k = i; k < i + win; k += 4) s += ch[k] * ch[k]
    const rms = Math.sqrt(s / (win / 4))
    sum += rms * rms
    n++
    if (rms > 0.01) {
      if (first < 0) first = i
      last = i + win
    }
    if (rms - prev > jump) {
      jump = rms - prev
      hit = i
    }
    prev = rms
  }
  const rms = Math.sqrt(sum / Math.max(1, n))
  const target = { bgm: 0.09, sting: 0.2, whisper: 0.12, sfx: 0.16, voice: 0.2 }[kind] || 0.15
  buf._norm = Math.min(4, target / Math.max(0.005, rms))
  buf._start = Math.max(0, first) / sr
  buf._end = (last || ch.length) / sr
  buf._hit = hit / sr
  return buf
}
const bufCache = {}
function loadBuffer(path, kind) {
  const c = ac()
  if (!c) return Promise.resolve(null)
  if (!bufCache[path]) {
    const entry = { buf: null }
    entry.p = fetch(path)
      .then((r) => (r.ok && !(r.headers.get('content-type') || '').includes('text/html') ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      .then((b) => new Promise((res, rej) => c.decodeAudioData(b, res, rej)))   // 사파리 옛 버전은 콜백형만
      .then((b) => (entry.buf = analyse(b, kind)))
      .catch(() => null)
    bufCache[path] = entry
  }
  return bufCache[path].p
}
const cached = (path) => (path && bufCache[path]?.buf) || null

/** 사건에 들어설 때 미리 받아 두기 — 사건 곡 · 연출음 · (공포면) 속삭임 */
export function preloadCaseSounds(c) {
  if (!ac()) return
  if (c?.music?.court) loadBuffer(c.music.court, 'bgm')
  manifest().then((m) => {
    if (!m) return
    ;['lie', 'twist', 'win', 'lose', 'objection', 'present', 'reveal'].forEach(loadSting)
    preloadSet('court')
    preloadSet('inquiry')
    preloadSet(sfxSetFor(c))
    if (c?.tone === 'horror' || c?.tone === 'thriller') {
      loadSting('scare')
      ;(m.whisper || []).forEach((w) => loadBuffer(w, 'whisper'))
    }
    if (c?.tone === 'horror' && m.amb?.horror) loadBuffer(m.amb.horror, 'bgm')
  })
}
/** 사건의 효과음 세트 — 배치가 정해 둔 music.sfxSet, 없으면 공포는 폐가 · 그 밖은 도시 */
export function sfxSetFor(c) {
  return c?.music?.sfxSet || (c?.tone === 'horror' ? 'house' : 'city')
}

// ------------------------------------------------------------------ 소리 재료
const noiseBuffer = (() => {
  let buf = null
  return () => {
    if (buf) return buf
    const c = ac()
    buf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < d.length; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02 // 갈색 잡음 (빗소리·실내 소음 느낌)
      d[i] = last * 3.5
    }
    return buf
  }
})()
const whiteBuffer = (() => {
  let buf = null
  return () => {
    if (buf) return buf
    const c = ac()
    buf = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return buf
  }
})()

function env(gainNode, t, attack, peak, decay) {
  gainNode.gain.setValueAtTime(0.0001, t)
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}
function panner(c, pan, to) {
  if (!c.createStereoPanner) return to
  const p = c.createStereoPanner()
  p.pan.value = Math.max(-1, Math.min(1, pan))
  p.connect(to)
  return p
}
const rand = (a, b) => a + Math.random() * (b - a)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

function tone({ freq, type = 'sine', at = 0, attack = 0.005, peak = 0.3, decay = 0.2, to = null }) {
  const c = ac()
  if (!c) return
  const t = c.currentTime + at
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + attack + decay)
  env(g, t, attack, peak, decay)
  o.connect(g).connect(bus.sfx)
  o.start(t)
  o.stop(t + attack + decay + 0.05)
}

function noise({ at = 0, peak = 0.3, decay = 0.1, freq = 1200, q = 1, type = 'bandpass' }) {
  const c = ac()
  if (!c) return
  const t = c.currentTime + at
  const src = c.createBufferSource()
  src.buffer = noiseBuffer()
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = c.createGain()
  env(g, t, 0.002, peak, decay)
  src.connect(f).connect(g).connect(bus.sfx)
  src.start(t, Math.random() * 3)
  src.stop(t + decay + 0.05)
}

const on = () => settings.sfx && ac()
const scareLevel = () => settings.scare || 'full'

// ------------------------------------------------------------------ 울림 (리버브) — 생성한 임펄스 응답
//   room: 돌벽 법정 (1.9초) · hall: 공포용 텅 빈 큰 공간 (4.5초, 어둡게)
function makeReverb(seconds, decayPow, lp, out, level) {
  const c = ac()
  const len = Math.floor(c.sampleRate * seconds)
  const ir = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      const t = i / c.sampleRate
      const early = t < 0.06 && Math.random() < 0.02 ? 0.8 : 0
      d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - i / len, decayPow) * 0.6 + early * (Math.random() * 2 - 1)) * (ch ? 0.96 : 1)
    }
  }
  const conv = c.createConvolver()
  conv.buffer = ir
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = lp
  const inp = c.createGain()
  inp.gain.value = level
  inp.connect(conv).connect(f).connect(out)
  return inp
}
let roomIn = null
function room() {
  if (!ac()) return null
  if (!roomIn) roomIn = makeReverb(1.9, 3.2, 3200, bus.sfx, 0.32)
  return roomIn
}
let hallIns = {}
function hall(out = 'amb') {
  if (!ac()) return null
  if (!hallIns[out]) hallIns[out] = makeReverb(4.5, 2.2, 2400, bus[out], 0.5)
  return hallIns[out]
}

// 한 음 — 필터 엔벨로프 · 잔향 보내기까지 (금관 · 팀파니 · 나무 공명용)
function voice({ freq, type = 'sine', at = 0, attack = 0.004, peak = 0.3, decay = 0.3, to = null, filter = null, wet = 0.35, detune = 0, out = null, rev = null }) {
  const c = ac()
  if (!c) return
  const t = c.currentTime + at
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (detune) o.detune.value = detune
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + attack + decay)
  const g = c.createGain()
  env(g, t, attack, peak, decay)
  let node = o
  if (filter) {
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.Q.value = filter.q || 1
    f.frequency.setValueAtTime(filter.from, t)
    f.frequency.exponentialRampToValueAtTime(filter.to, t + attack + decay)
    node = node.connect(f)
  }
  node.connect(g)
  g.connect(out || bus.sfx)
  const r = rev || room()
  if (r && wet) {
    const s = c.createGain()
    s.gain.value = wet
    g.connect(s).connect(r)
  }
  o.start(t)
  o.stop(t + attack + decay + 0.1)
}

function burst({ at = 0, peak = 0.3, decay = 0.05, freq = 3000, q = 0.8, type = 'bandpass', wet = 0.3, sweepTo = null, attack = 0.001, out = null, rev = null }) {
  const c = ac()
  if (!c) return
  const t = c.currentTime + at
  const src = c.createBufferSource()
  src.buffer = whiteBuffer()
  src.loop = true
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(freq, t)
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + decay)
  f.Q.value = q
  const g = c.createGain()
  env(g, t, attack, peak, decay)
  src.connect(f).connect(g).connect(out || bus.sfx)
  const r = rev || room()
  if (r && wet) {
    const s = c.createGain()
    s.gain.value = wet
    g.connect(s).connect(r)
  }
  src.start(t, Math.random() * 0.5)
  src.stop(t + attack + decay + 0.05)
}

// 의사봉 한 번 — 단단한 나무가 나무 받침을 치는 소리: 딱(고음 순간음) + 나무 공명(여러 고유 진동) + 둔탁한 저음
function gavelHit(at, strength = 1) {
  burst({ at, peak: 0.55 * strength, decay: 0.012, freq: 3800, q: 0.7, type: 'highpass', wet: 0.4 })
  ;[[212, 0.22], [431, 0.12], [689, 0.07], [1120, 0.04]].forEach(([f, d], k) =>
    voice({ freq: f * (1 + (Math.random() - 0.5) * 0.01), type: 'sine', at, peak: [0.42, 0.2, 0.1, 0.06][k] * strength, decay: d, wet: 0.45 }),
  )
  voice({ freq: 95, type: 'sine', at, peak: 0.55 * strength, decay: 0.16, to: 52, wet: 0.2 })
}

// 버퍼 한 번 재생 (연출음 · 속삭임)
function playBuffer(buf, { at = 0, gain = 1, out = bus.sfx, offset = null, pan = 0, rate = 1, reverse = false, lp = null, wet = 0, rev = null, fadeOut = null } = {}) {
  const c = ac()
  const src = c.createBufferSource()
  if (reverse) {
    if (!buf._rev) {
      const r = c.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate)
      for (let ch = 0; ch < buf.numberOfChannels; ch++) r.getChannelData(ch).set(buf.getChannelData(ch).slice().reverse())
      buf._rev = r
    }
    src.buffer = buf._rev
  } else src.buffer = buf
  src.playbackRate.value = rate
  const g = c.createGain()
  const t = c.currentTime + at
  g.gain.value = gain * (buf._norm || 1)
  let node = src
  if (lp) {
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = lp
    node = node.connect(f)
  }
  node.connect(g)
  g.connect(panner(c, pan, out))
  if (wet && rev) {
    const s = c.createGain()
    s.gain.value = wet
    g.connect(s).connect(rev)
  }
  const from = offset ?? (reverse ? 0 : buf._start || 0)
  src.start(t, from)
  if (fadeOut) {
    g.gain.setValueAtTime(gain * (buf._norm || 1), t + fadeOut[0])
    g.gain.exponentialRampToValueAtTime(0.0001, t + fadeOut[0] + fadeOut[1])
    src.stop(t + fadeOut[0] + fadeOut[1] + 0.05)
  }
  return src
}

// ------------------------------------------------------------------ 목소리 (Gemini TTS — 저장소의 voice/<이름>, 없으면 public/judge/voice/*.wav)
//   objection_f · objection_m (이의 있습니다!) · sustained_f/m (이의를 인정합니다.) · overruled_f/m (이의를 기각합니다.)
const voices = {}
function loadVoice(name) {
  const c = ac()
  if (!c) return Promise.resolve(null)
  if (!voices[name]) {
    const local = () => fetch(`/judge/voice/${name}.wav`)   // 최후의 변론 자산 폴더 (2026-11-26 — 옛 /voice/ 는 301)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      .then((b) => new Promise((res, rej) => c.decodeAudioData(b, res, rej)))
      .catch(() => null)
    voices[name] = manifest().then((m) => (m?.voice?.[name] ? loadBuffer(m.voice[name], 'voice') : null)).then((b) => b || local())
  }
  return voices[name]
}
export function preloadVoices() {
  ;['objection_f', 'objection_m', 'sustained_f', 'sustained_m', 'overruled_f', 'overruled_m'].forEach((n) => loadVoice(n))
}
export function speak(name, { at = 0, gain = 1 } = {}) {
  if (!on()) return
  loadVoice(name).then((buf) => {
    if (!buf) return
    const c = ac()
    const src = c.createBufferSource()
    src.buffer = buf
    const g = c.createGain()
    g.gain.value = gain * (buf._norm ? Math.min(buf._norm, 2) : 1)
    src.connect(g).connect(bus.voice)
    const r = room()
    if (r) {
      const s = c.createGain()
      s.gain.value = 0.18          // 법정에 울리는 정도
      g.connect(s).connect(r)
    }
    src.start(c.currentTime + at)
    // 말하는 동안 음악을 낮춘다 (사이드체인 덕킹)
    const release = addDuck(0.4, 0.6, 0.05)
    setTimeout(() => release(0.6), (at + buf.duration) * 1000)
  })
}

// ------------------------------------------------------------------ 연출음 (스팅어)
//   생성 음원이 이미 받아져 있으면 그것, 아니면 합성 — 화면 연출과 어긋나지 않게 기다리지 않는다
const STING_PROC = {
  scare(gain) {
    // 깜짝 — 날카로운 현의 비명(반음 덩어리가 미끄러져 내림) + 쇠 부딪힘 + 땅이 꺼지는 저음
    ;[1760, 1864.7, 1975.5, 2093, 2217.5].forEach((f) =>
      voice({ freq: f, type: 'sawtooth', attack: 0.004, peak: 0.045 * gain, decay: 1.2, to: f * 0.9, filter: { from: 9000, to: 2400 }, wet: 0.6, detune: rand(-15, 15) }))
    ;[73.4, 77.8, 82.4, 87.3].forEach((f) =>
      voice({ freq: f, type: 'sawtooth', attack: 0.006, peak: 0.07 * gain, decay: 1.6, filter: { from: 2400, to: 300 }, wet: 0.5 }))
    burst({ peak: 0.6 * gain, decay: 0.35, freq: 2600, q: 0.5, wet: 0.6 })
    burst({ peak: 0.3 * gain, decay: 0.9, freq: 5200, q: 6, wet: 0.7 })          // 쇠가 우는 소리
    voice({ freq: 58, peak: 0.85 * gain, decay: 1.6, to: 30, wet: 0.4 })
  },
  twist(gain) {
    // 반전 — 거꾸로 빨려 드는 바람 → 거대한 저음 붐 + 낮은 금관 덩어리
    burst({ peak: 0.22 * gain, attack: 0.7, decay: 0.05, freq: 300, sweepTo: 5000, q: 0.8, wet: 0.3 })
    const at = 0.72
    voice({ freq: 52, at, peak: 0.9 * gain, decay: 2.2, to: 28, wet: 0.45 })
    burst({ at, peak: 0.45 * gain, decay: 0.12, freq: 700, q: 0.5, wet: 0.5 })
    ;[[98, -6], [116.5, 5], [146.8, -4], [155.6, 7]].forEach(([f, dt]) =>
      voice({ freq: f, type: 'sawtooth', at, attack: 0.02, peak: 0.06 * gain, decay: 2.4, detune: dt, filter: { from: 2600, to: 380, q: 1.2 }, wet: 0.55 }))
  },
  lie(gain) {
    // 거짓 붕괴 — 유리가 산산조각 + 관현악 일격 + 팀파니
    for (let i = 0; i < 16; i++) voice({ freq: rand(2400, 9500), at: rand(0, 0.28), attack: 0.001, peak: rand(0.02, 0.06) * gain, decay: rand(0.05, 0.35), wet: 0.5 })
    burst({ peak: 0.4 * gain, decay: 0.18, freq: 5500, q: 0.4, type: 'highpass', wet: 0.4 })
    ;[[146.83, 0], [220, 4], [293.66, -4], [349.23, 6]].forEach(([f, dt]) =>
      voice({ freq: f, type: 'sawtooth', attack: 0.01, peak: 0.08 * gain, decay: 0.7, detune: dt, filter: { from: 4500, to: 500, q: 1.3 }, wet: 0.45 }))
    voice({ freq: 70, peak: 0.7 * gain, decay: 0.6, to: 52, wet: 0.35 })
  },
  win(gain) {
    ;[392, 523.25, 659.25].forEach((f, i) =>
      voice({ freq: f, type: 'sawtooth', at: i * 0.13, attack: 0.01, peak: 0.06 * gain, decay: 0.35, filter: { from: 3000, to: 900 }, wet: 0.4 }))
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f) => voice({ freq: f, type: 'triangle', at: 0.42, attack: 0.03, peak: 0.09 * gain, decay: 1.6, wet: 0.55 }))
  },
  lose(gain) {
    ;[[293.66, 0], [261.63, 0.35], [233.08, 0.7]].forEach(([f, at]) =>
      voice({ freq: f, type: 'sawtooth', at, attack: 0.08, peak: 0.06 * gain, decay: 0.9, filter: { from: 1400, to: 400 }, wet: 0.5 }))
    voice({ freq: 116.54, at: 0.7, attack: 0.1, peak: 0.2 * gain, decay: 1.6, wet: 0.4 })
  },
}
export function sting(name, { gain = 1, duck = 0.25, hold = 1.8 } = {}) {
  if (!on()) return
  // 변주가 여럿이면 받아 둔 것 중 하나를 무작위로 (같은 깜짝 소리가 매번 반복되지 않게)
  const ready = stingPaths(name).map(cached).filter(Boolean)
  const buf = ready.length ? pick(ready) : null
  if (buf) {
    // 'scare' 처럼 앞에 몰아치는 부분이 있는 음원은 가장 센 타격 바로 앞부터
    const offset = name === 'scare' ? Math.max(buf._start, buf._hit - 0.35) : buf._start   // 휙 빨려 드는 앞부분은 조금 남긴다
    playBuffer(buf, { gain: gain * 0.9, offset })
  } else {
    loadSting(name)
    STING_PROC[name]?.(gain)
  }
  if (duck < 1) {
    const release = addDuck(duck, Math.min(1, duck * 1.6), 0.03)
    setTimeout(() => release(1.2), hold * 1000)
  }
}

// ------------------------------------------------------------------ 효과음
export const sfx = {
  move() {
    if (on()) tone({ freq: 880, type: 'triangle', peak: 0.04, decay: 0.05 })
  },
  select() {
    if (!on()) return
    tone({ freq: 660, type: 'triangle', peak: 0.07, decay: 0.08 })
    tone({ freq: 990, type: 'triangle', peak: 0.05, decay: 0.12, at: 0.05 })
  },
  paper() {
    if (!on()) return
    if (sample('court', 'page', { gain: 0.6, rate: rand(0.95, 1.08) })) return       // 생성한 종이 넘김 (있으면)
    noise({ peak: 0.1, decay: 0.16, freq: 3200, q: 0.6 })
    noise({ at: 0.06, peak: 0.06, decay: 0.12, freq: 5200, q: 0.8 })
  },
  type: (() => {
    let last = 0
    return () => {
      const now = performance.now()
      if (now - last < 45 || !on()) return
      last = now
      noise({ peak: 0.04, decay: 0.025, freq: 2500 + Math.random() * 1500, q: 3 })
    }
  })(),
  gavel(times = 3) {
    if (!on()) return
    // 세 번 칠 때는 마지막이 가장 세고 간격이 살짝 벌어진다 (사람이 치는 박자) — 생성한 실제 의사봉 소리가 있으면 그것
    const real = (manifestCached?.sfx?.court?.gavel || []).some((p) => cached(p))
    if (!real) preloadSet('court')
    for (let i = 0; i < times; i++) {
      const at = i * (0.34 + i * 0.03)
      const strong = times > 1 && i === times - 1 ? 1.15 : 0.9
      if (real) sample('court', 'gavel', { at, gain: strong, rate: rand(0.97, 1.03), wet: 0.25, rev: room() })
      else gavelHit(at, strong)
    }
  },
  stamp() {
    if (!on()) return
    if (sample('court', 'stamp', { gain: 1 })) return
    // 도장: 고무가 종이를 누르는 둔탁한 소리 + 책상 울림 + 종이 바스락
    voice({ freq: 110, type: 'sine', peak: 0.55, decay: 0.14, to: 48, wet: 0.25 })
    burst({ peak: 0.35, decay: 0.05, freq: 700, q: 0.6, wet: 0.3 })
    burst({ at: 0.02, peak: 0.12, decay: 0.12, freq: 4200, q: 0.4, type: 'highpass', wet: 0.15 })
  },
  reveal() {
    if (!on()) return
    // 공포 사건에서는 맑은 종 대신 섬뜩한 일격 — 가끔은 정적 뒤 깜짝
    if (horrorActive() && scareLevel() !== 'off') return horrorReveal()
    // 생성한 발견 차임 — 조사 중 자주 나는 소리라 작게, 배경음은 거의 낮추지 않는다
    //   (운영 제보 2026-11-22: 너무 커서 배경음이 줄어드는 것처럼 들림 — 예전 gain 1 · duck 0.5)
    if (cached(manifestCached?.sting?.reveal)) return sting('reveal', { gain: 0.4, duck: 0.85, hold: 0.6 })
    // 단서 발견: 맑은 종 (비정수배 배음) 이 차례로 — 잔향 길게
    ;[659.25, 830.61, 987.77, 1318.5].forEach((f, i) => {
      voice({ freq: f, type: 'sine', at: i * 0.085, peak: 0.13, decay: 1.1, wet: 0.6 })
      voice({ freq: f * 2.76, type: 'sine', at: i * 0.085, peak: 0.03, decay: 0.4, wet: 0.6 })
    })
    voice({ freq: 82.4, type: 'sine', peak: 0.25, decay: 0.8, wet: 0.3 })
  },
  objection(gender = null) {
    if (!on()) return
    // 목소리가 있으면 금관 일격과 함께 "이의 있습니다!" (f: 검사 · m: 변호인)
    if (gender) speak(`objection_${gender}`, { at: 0.1 })
    if (cached(manifestCached?.sting?.objection)) return sting('objection', { duck: 0.3, hold: 1 })   // 생성한 관현악 일격
    if (manifestCached?.sting?.objection) loadBuffer(manifestCached.sting.objection, 'sting')
    // 이의 있습니다!: 빨려 들어가는 숨 → 금관 화음 일격 (필터가 열렸다 닫힘) + 팀파니 + 충격음
    burst({ peak: 0.16, decay: 0.16, freq: 300, sweepTo: 4000, q: 0.9, wet: 0.2 })
    const at = 0.15
    ;[[146.83, 0], [220, 4], [293.66, -4], [349.23, 6], [440, -3]].forEach(([f, dt]) => {
      voice({ freq: f, type: 'sawtooth', at, attack: 0.012, peak: 0.075, decay: 0.55, detune: dt, filter: { from: 4200, to: 600, q: 1.4 }, wet: 0.45 })
      voice({ freq: f, type: 'sawtooth', at, attack: 0.012, peak: 0.04, decay: 0.55, detune: dt + 9, filter: { from: 4200, to: 600, q: 1.4 }, wet: 0.45 })
    })
    voice({ freq: 73, type: 'sine', at, peak: 0.6, decay: 0.45, to: 58, wet: 0.35 })
    voice({ freq: 41, type: 'sine', at, peak: 0.5, decay: 0.7, to: 32, wet: 0 })   // 몸으로 느끼는 저음
    burst({ at, peak: 0.4, decay: 0.09, freq: 900, q: 0.6, wet: 0.35 })
    burst({ at, peak: 0.18, decay: 0.02, freq: 5000, q: 0.5, type: 'highpass', wet: 0.3 })
    const release = addDuck(0.3, 0.5, 0.02)
    setTimeout(() => release(0.9), 900)
  },
  error() {
    if (on()) tone({ freq: 180, type: 'square', peak: 0.05, decay: 0.2, to: 120 })
  },
  win() {
    sting('win', { duck: 0.15, hold: 6 })
  },
  lose() {
    sting('lose', { duck: 0.15, hold: 6 })
  },
  cctv() {
    if (on()) noise({ peak: 0.08, decay: 0.3, freq: 5000, q: 0.3, type: 'highpass' })
  },
  /** 거짓 붕괴 — 공포 사건이면 정적 뒤 비명 같은 일격까지 */
  broken() {
    if (horrorActive() && scareLevel() === 'full') return jumpScare({ delay: 0.25, whisperChance: 0.6 })
    sting('lie', { duck: 0.2, hold: 2 })
    sample('court', 'gasp', { at: 0.5, gain: 0.5 })                 // 방청석이 술렁인다 (있으면)
  },
  /** 증거 제시 — 휙 · 탁 (없으면 도장) */
  present() {
    if (!on()) return
    if (cached(manifestCached?.sting?.present)) return sting('present', { gain: 0.6, duck: 0.7, hold: 0.7 })
    sfx.stamp()
  },
  /** 현장 조사 — 도구를 바꿀 때 · 뒤졌는데 아무것도 없을 때 */
  tool() {
    if (!on()) return
    if (!sample('inquiry', 'flashlight', { gain: 0.7 })) sfx.move()
  },
  search() {
    if (!on()) return
    if (!sample('inquiry', 'rummage', { gain: 0.5 })) sfx.move()
  },
  /** 남은 시간 경고 (10초) */
  warn() {
    if (!on()) return
    if (cached(manifestCached?.sting?.present)) return sting('present', { gain: 0.6, duck: 0.7, hold: 0.7 })
    sfx.objection()
  },
  /** 숨은 반전이 드러나는 순간 */
  twist() {
    sting('twist', { duck: 0.15, hold: 3.5 })
    if (horrorActive() && scareLevel() !== 'off') setTimeout(() => whisper({ close: true, gain: 0.8 }), 1600)
  },
}

// ------------------------------------------------------------------ 공포 연출
let lastScare = 0
function horrorActive() {
  return ambNow?.key === 'horror'
}
/** 정적 → 충격: 배경을 순간 0 으로 떨어뜨리고, 숨 막히는 정적 뒤 일격 (+ 귓가 속삭임) */
function jumpScare({ delay = rand(0.7, 1.3), whisperChance = 0.5 } = {}) {
  if (!on()) return
  lastScare = performance.now()
  const release = addDuck(0.0001, 0.0001, 0.05)
  setTimeout(() => {
    sting('scare', { gain: 1, duck: 1 })
    if (Math.random() < whisperChance) setTimeout(() => whisper({ close: true, gain: 1, out: 'sfx' }), 700)
    setTimeout(() => release(1.6), 2200)
  }, delay * 1000)
}
function horrorReveal() {
  const lvl = scareLevel()
  const cool = performance.now() - lastScare > 40000
  if (lvl === 'full' && cool && Math.random() < 0.4) return jumpScare()
  // 섬뜩한 일격 — 낮은 붐 + 반음으로 부딪히는 고음 + 거꾸로 감기는 숨
  const g = lvl === 'soft' ? 0.5 : 0.85
  burst({ peak: 0.12 * g, attack: 0.45, decay: 0.05, freq: 900, sweepTo: 3000, q: 1.2, wet: 0.4 })
  voice({ freq: 49, at: 0.45, peak: 0.7 * g, decay: 1.8, to: 31, wet: 0.5 })
  ;[1244.5, 1318.5].forEach((f) => voice({ freq: f, type: 'sine', at: 0.45, attack: 0.01, peak: 0.05 * g, decay: 2.2, wet: 0.8 }))
  voice({ freq: 87.3, type: 'sawtooth', at: 0.45, attack: 0.02, peak: 0.05 * g, decay: 1.8, filter: { from: 1800, to: 200 }, wet: 0.5 })
  if (Math.random() < (lvl === 'soft' ? 0.2 : 0.45)) setTimeout(() => whisper({ gain: 0.8 }), 1400)
}
// 공포 사건의 세기 — 사건 난이도(1~5). 환경음 간격 · 세기와 장소 속삭임 확률이 따라간다 (설정 soft · off 가 우선)
const horrorDifficulty = () => Math.max(1, Math.min(5, Math.round(Number(scene.difficulty)) || 3))   // 정수 (배열 칸)
const horrorPace = () => [1.5, 1.25, 1, 0.85, 0.7][horrorDifficulty() - 1]      // 사건 사이 간격 배율 (작을수록 잦음)
const horrorGain = () => [0.8, 0.9, 1, 1.05, 1.12][horrorDifficulty() - 1]

/** 사진 속에 무언가 비친 순간 — 연출음 없이, 배경과 환경음만 잠깐 숨을 죽였다가 천천히 돌아온다 */
export function horrorHush(ms = 1600) {
  if (!horrorActive() || !ac() || scareLevel() === 'off') return
  const soft = scareLevel() === 'soft'
  const release = addDuck(soft ? 0.5 : 0.28, soft ? 0.35 : 0.06, 0.05)
  setTimeout(() => release(2.6), ms)
}

/** 화면에서 직접 부르는 공포 사건 이벤트 — enter(장소 들어감) · present(증거 제시) · break(증인 무너짐) */
export function horrorEvent(kind) {
  if (!horrorActive() || !on()) return
  const lvl = scareLevel()
  if (lvl === 'off') return
  if (kind === 'enter') {
    const chance = lvl === 'soft' ? 0.35 : [0.35, 0.45, 0.6, 0.7, 0.8][horrorDifficulty() - 1]
    if (Math.random() < chance) setTimeout(() => whisper({ gain: lvl === 'soft' ? 0.5 : 0.9 }), rand(1200, 3500))
  } else if (kind === 'break') {
    if (lvl === 'full') jumpScare({ delay: 0.3, whisperChance: 0.7 })
  } else if (kind === 'present' && lvl === 'full' && Math.random() < 0.25) {
    setTimeout(() => whisper({ close: true }), 900)
  }
}

// 속삭임 — 받아 둔 것만 (없으면 받기 시작하고 이번엔 건너뜀). 좌우 어딘가에서, 가끔은 거꾸로 · 낮게
function whisper({ close = false, gain = 1, out = 'amb', pan = null } = {}) {
  const c = ac()
  if (!c || !manifestCached?.whisper?.length) return false
  const list = manifestCached.whisper
  const ready = list.filter((p) => cached(p))
  if (ready.length < list.length) list.forEach((p) => loadBuffer(p, 'whisper'))
  if (!ready.length) return false
  const buf = cached(pick(ready))
  const p = pan ?? (close ? rand(-0.35, 0.35) : pick([-1, 1]) * rand(0.55, 0.98))
  playBuffer(buf, {
    out: bus[out], gain: gain * (close ? 0.9 : 0.55), pan: p, rate: rand(0.84, 0.98), reverse: !close && Math.random() < 0.18,
    lp: close ? 7500 : 2800, wet: close ? 0.25 : 0.9, rev: hall(out),
  })
  return true
}

// ------------------------------------------------------------------ 장면 (음악 + 환경음)
//   THEMES (합성 음악)의 이름 = 생성 배경음 이름 (public/sound/bgm/<이름>-N.mp3)
//   calm 메인 · tense 법정(공통) · thriller · dramatic · light(유머 · 황당) · touching · sad · horror
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12)
const PROGRESSIONS = [
  [[38, 57, 60, 64, 65], [34, 53, 57, 62, 64], [31, 55, 58, 62, 65], [33, 52, 57, 61, 64]], // Dm9 · Bbmaj7 · Gm9 · A7
  [[38, 57, 62, 65, 69], [36, 55, 60, 64, 67], [34, 53, 58, 62, 65], [33, 55, 57, 61, 64]], // Dm · C · Bb · A7
  [[38, 57, 60, 65, 64], [29, 57, 60, 64, 69], [31, 58, 62, 65, 67], [33, 57, 61, 64, 67]], // Dm · Fmaj7 · Gm · A
]
const THRILLER_PROGS = [
  [[40, 52, 55, 58], [41, 53, 56, 59], [40, 52, 55, 58], [39, 51, 54, 57]],   // E 감7 · F 감7 … 반음으로 조여 온다
  [[40, 52, 55, 59], [46, 52, 55, 58], [41, 53, 56, 60], [35, 51, 54, 59]],
]
const DRAMATIC_PROGS = [
  [[33, 57, 60, 64], [29, 57, 60, 65], [36, 55, 60, 64], [31, 55, 59, 62]],   // Am · F · C · G
  [[33, 57, 60, 64], [38, 57, 62, 65], [29, 57, 60, 65], [28, 56, 59, 64]],   // Am · Dm · F · E
  [[29, 57, 60, 65], [31, 55, 59, 62], [28, 56, 59, 64], [33, 57, 60, 64]],   // F · G · E · Am
]
const LIGHT_PROGS = [
  [[36, 60, 64, 67], [41, 60, 65, 69], [43, 62, 67, 71], [36, 60, 64, 67]],   // C · F · G · C
  [[36, 60, 64, 67], [33, 60, 64, 69], [38, 62, 65, 69], [43, 59, 62, 67]],   // C · Am · Dm · G
]
const TOUCHING_PROGS = [
  [[36, 60, 64, 67], [43, 59, 62, 67], [45, 57, 60, 64], [41, 57, 60, 65]],   // C · G · Am · F — 벅차오르는 진행
  [[41, 57, 60, 65], [43, 59, 62, 67], [40, 59, 64, 67], [45, 57, 60, 64]],   // F · G · Em · Am
]
const SAD_PROGS = [
  [[33, 57, 60, 64], [29, 57, 60, 65], [28, 56, 59, 64], [33, 57, 60, 64]],   // Am · F · E · Am — 가라앉는 단조
  [[38, 57, 62, 65], [33, 57, 60, 64], [34, 58, 62, 65], [28, 56, 59, 64]],   // Dm · Am · Bb · E
]
// 공포 — 조성이 없다: 반음 · 증4도로 부딪히는 낮은 덩어리 (어디로도 해결되지 않는 진행)
const HORROR_PROGS = [
  [[33, 56, 57, 63], [32, 55, 56, 62], [33, 56, 57, 63], [27, 54, 57, 60]],
  [[31, 54, 55, 61], [30, 53, 54, 60], [36, 54, 55, 61], [30, 53, 54, 60]],
]
const MINOR_MELODY = [62, 64, 65, 67, 69, 72, 74, 76, 77]
const MAJOR_MELODY = [72, 74, 76, 77, 79, 81, 84]
const THEMES = {
  calm:     { progs: PROGRESSIONS, bar: 7.5, tone: 1700, level: 1 },
  tense:    { progs: PROGRESSIONS, bar: 7.5, tone: 900, level: 1 },
  thriller: { progs: THRILLER_PROGS, bar: 6, tone: 1400, level: 1.15 },
  dramatic: { progs: DRAMATIC_PROGS, bar: 6.4, tone: 2600, level: 1.1 },
  light:    { progs: LIGHT_PROGS, bar: 2.4, tone: 4200, level: 1.05 },
  touching: { progs: TOUCHING_PROGS, bar: 6.4, tone: 3000, level: 1.1 },
  sad:      { progs: SAD_PROGS, bar: 8, tone: 1900, level: 1.05 },
  horror:   { progs: HORROR_PROGS, bar: 9, tone: 800, level: 1.2 },
}

// 사건 분위기(tone)의 공용 곡 — 사건 전용 곡이 없을 때 (난이도와 상관없이: 지옥 사건도 자기 곡 · 자기 분위기)
export function themeForCase(c) {
  if (!c) return 'calm'
  return { thriller: 'thriller', dramatic: 'dramatic', touching: 'touching', sad: 'sad', horror: 'horror', humorous: 'light', absurd: 'light' }[c.tone] || 'tense'
}

// 법정 음악 — 법정에 들어서면 모든 사건이 공통 법정 곡으로 바뀐다 (공포 사건도 같게 — 사용자 요청 2026-11-22.
//   공포 사건은 공포 환경음 층이 법정에서도 그대로 깔려 무서움은 이어진다)
// 현장 조사까지는 사건 전용 곡('case:court') — 받지 못하면 사건 분위기 곡
export const COURT_MUSIC = 'tense'
const courtBase = (c) => (c?.tone === 'horror' ? 'horror' : themeForCase(c))
export function courtMusicFor(c, { inCourt = true } = {}) {
  if (inCourt) return COURT_MUSIC
  return c?.music?.court ? 'case:court' : courtBase(c)
}
/** 사건 소개 시네마틱 — 사건 곡이 있으면 그대로 법정까지 이어진다 */
export function introMusicFor(c) {
  return c?.music?.court ? 'case:court' : themeForCase(c)
}
/** 판결 뒤 '사건의 진실' 시네마틱 */
export function behindMusicFor(c) {
  return c?.music?.behind ? 'case:behind' : themeForCase(c)
}

const scene = { mood: 'calm', tone: null, music: null, base: {}, difficulty: 3 }
let musicNow = null     // { mood, src, handle }
let ambNow = null       // { key, handle }
export const getBgmMood = () => scene.mood

export function setBgmMood(m) {
  const next = THEMES[m] || /^case:(court|behind)$/.test(m) ? m : 'calm'
  if (next === scene.mood) return
  scene.mood = next
  refreshScene(1.2)
}
/** 지금 사건 — 분위기(공포 · 스릴러 환경음 층)와 사건 전용 곡. 사건을 나가면 setCase(null) */
export function setCase(c) {
  scene.tone = c?.tone || null
  scene.music = c?.music || null
  scene.difficulty = c?.difficulty || 3
  scene.base = c ? { court: courtBase(c), behind: themeForCase(c) } : {}
  scene.sfxSet = c ? sfxSetFor(c) : null
  refreshScene(1.5)
}
export function setCaseTone(tone) {
  setCase(tone ? { tone } : null)
}
// 'case:court' 같은 사건 곡 이름 → (실제 음원 주소, 대신할 분위기)
function resolveMood(mood) {
  const m = /^case:(court|behind)$/.exec(mood)
  if (!m) return { src: null, mood }
  return { src: scene.music?.[m[1]] || null, mood: scene.base[m[1]] || (m[1] === 'court' ? COURT_MUSIC : 'calm') }
}

function ambienceKey() {
  const { tone } = scene
  const { mood } = resolveMood(scene.mood)
  // 공포 환경음은 법정 밖(사건 소개 · 현장 조사)에서만 — 법정에 들어서면(법정 곡 'tense') 일반 법정 환경음으로 (사용자 요청 2026-11-22)
  if (mood === 'horror' || (tone === 'horror' && mood === 'thriller')) return 'horror'
  if (mood === 'thriller' || (tone === 'thriller' && mood === 'tense')) return 'thriller'
  if (mood === 'tense') return 'court'
  if (mood === 'calm' || mood === 'sad' || mood === 'dramatic') return 'rain'
  return 'none'
}

// 다른 게임 · 허브에 있는 동안 — 최후의 변론 배경음 · 환경음을 끄고 다시 켜지지 않게 (App.jsx 가 화면마다 알려 준다)
let away = false
export function setAway(v) {
  away = !!v
  if (away) stopScene(0.6)
  else if (ctx && settings.ambient) refreshScene(1.2)
}

function refreshScene(fadeIn = 1.2) {
  if (!ctx || !settings.ambient || away) return
  const want = resolveMood(scene.mood)
  if (musicNow?.mood !== scene.mood || musicNow?.src !== want.src) {
    musicNow?.handle.stop(0.8)
    musicNow = { mood: scene.mood, src: want.src, handle: startMusic(want.mood, fadeIn, want.src, scene.mood === 'case:behind') }
  }
  const key = ambienceKey()
  if (ambNow?.key !== key) {
    ambNow?.handle.stop(1.5)
    ambNow = { key, handle: startAmbience(key, fadeIn) }
  }
}
function stopScene(fade = 0.4) {
  musicNow?.handle.stop(fade)
  ambNow?.handle.stop(fade)
  musicNow = null
  ambNow = null
}
export function stopAmbient(fade = 0.4) {
  stopScene(fade)
}

// ------------------------------------------------------------------ 음악 — 생성 곡(교차 반복) 또는 합성 음악
// soft: 짧은 곡(사건의 진실 30초)이 시네마틱보다 짧으면 두 번째부터는 작게 깔기만 — 시네마틱이 끝나면 부드럽게 줄어든다
function startMusic(mood, fadeIn, src = null, soft = false) {
  const c = ac()
  const out = c.createGain()
  out.gain.value = 0.0001
  out.connect(bus.music)
  const st = { alive: true, inner: null }
  const begin = (inner) => {
    if (!st.alive) return inner.stop()
    st.inner = inner
    out.gain.cancelScheduledValues(c.currentTime)
    out.gain.setTargetAtTime(1, c.currentTime, Math.max(0.05, fadeIn / 3))
  }
  const shared = () => manifest().then((m) => {
    if (!st.alive) return
    const files = m?.bgm?.[mood]
    if (!files?.length) return begin(startProcedural(mood, out))
    Promise.all(files.map((f) => loadBuffer(f, 'bgm'))).then((bufs) => {
      const ok = bufs.filter(Boolean)
      begin(ok.length ? playLoop(ok, out) : startProcedural(mood, out))
    })
  })
  // 사건 전용 곡 → 못 받으면 분위기 공용 곡 → 합성
  if (src) loadBuffer(src, 'bgm').then((buf) => (buf ? begin(playLoop([buf], out, soft ? 0.45 : 1)) : shared()))
  else shared()
  return {
    stop(fade = 0.6) {
      st.alive = false
      const t = c.currentTime
      out.gain.cancelScheduledValues(t)
      out.gain.setTargetAtTime(0.0001, t, Math.max(0.03, fade / 3))
      setTimeout(() => {
        st.inner?.stop()
        out.disconnect()
      }, fade * 1000 + 900)
    },
  }
}

// 30초 곡 몇 벌을 끝 3초씩 겹쳐 이어 붙인다 — 매번 다른 벌로 (반복이 덜 느껴지게)
function playLoop(bufs, dest, later = 1) {
  const c = ctx
  const XF = 3
  let next = c.currentTime + 0.05
  let last = -1
  let first = true
  const live = new Set()
  const playOne = () => {
    const k = bufs.length > 1 ? (last + 1 + Math.floor(Math.random() * (bufs.length - 1))) % bufs.length : 0
    last = k
    const b = bufs[k]
    const at = Math.max(next, c.currentTime + 0.05)
    const start = b._start || 0
    const len = Math.max(XF * 2 + 1, (b._end || b.duration) - start)
    const src = c.createBufferSource()
    src.buffer = b
    const g = c.createGain()
    const lv = (b._norm || 1) * (first ? 1 : later)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.linearRampToValueAtTime(lv, at + (first ? 0.05 : XF))
    g.gain.setValueAtTime(lv, at + len - XF)
    g.gain.linearRampToValueAtTime(0.0001, at + len)
    src.connect(g).connect(dest)
    src.start(at, start)
    src.stop(at + len + 0.05)
    live.add(src)
    src.onended = () => live.delete(src)
    next = at + len - XF
    first = false
  }
  playOne()
  const timer = setInterval(() => {
    if (next - c.currentTime < 8) playOne()
  }, 1000)
  return {
    stop() {
      clearInterval(timer)
      live.forEach((s) => {
        try { s.stop() } catch { /* 이미 끝남 */ }
      })
    },
  }
}

// 합성 음악 (음원 파일이 없을 때) — 테마별 한 마디씩 예약
function startProcedural(name, dest) {
  const c = ctx
  const now = c.currentTime
  const th0 = THEMES[name] || THEMES.calm
  const bus2 = c.createGain()
  bus2.gain.value = th0.level * 0.9
  const tone = c.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = th0.tone
  tone.Q.value = 0.4
  const dry = c.createGain()
  dry.gain.value = 0.8
  bus2.connect(tone).connect(dry).connect(dest)
  const fbs = []
  ;[[0.37, 0.32], [0.61, 0.25]].forEach(([time, fb]) => {
    const d = c.createDelay(1.5)
    d.delayTime.value = time
    const g = c.createGain()
    g.gain.value = fb
    const wet = c.createGain()
    wet.gain.value = 0.22
    tone.connect(d).connect(g).connect(d)
    d.connect(wet).connect(dest)
    fbs.push(g)
  })
  const drums = c.createGain()
  drums.gain.value = 1
  drums.connect(dest)
  const busOut = bus2

  const vo = (freq, at, dur, peak, type = 'sine', detune = 0, attack = null, out = busOut) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.value = freq
    o.detune.value = detune
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + (attack ?? Math.min(2.4, dur * 0.35)))
    g.gain.setTargetAtTime(0.0001, at + dur * 0.7, dur * 0.18)
    o.connect(g).connect(out)
    o.start(at)
    o.stop(at + dur + 1.5)
  }
  const pluck = (freq, at, peak, len = 2.6, harmonics = [1, 0.22, 0.08]) => {
    harmonics.forEach((amp, k) => {
      if (!(amp > 0)) return
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = k === 0 ? 'triangle' : 'sine'
      o.frequency.value = freq * (k + 1)
      env(g, at, 0.008, peak * amp, len)
      o.connect(g).connect(busOut)
      o.start(at)
      o.stop(at + len + 0.2)
    })
  }
  const glide = (f0, f1, at, dur, peak, type = 'sine') => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(f0, at)
    o.frequency.exponentialRampToValueAtTime(f1, at + dur)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.15, dur * 0.2))
    g.gain.setTargetAtTime(0.0001, at + dur * 0.75, dur * 0.15)
    o.connect(g).connect(busOut)
    o.start(at)
    o.stop(at + dur + 0.6)
  }
  const drum = (freq, at, peak, len = 1.6, noiseAmt = 0.9, noiseFreq = 380) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(freq * 1.5, at)
    o.frequency.exponentialRampToValueAtTime(freq, at + 0.1)
    env(g, at, 0.004, peak, len)
    o.connect(g).connect(drums)
    o.start(at)
    o.stop(at + len + 0.2)
    if (noiseAmt > 0) {
      const n = c.createBufferSource()
      n.buffer = noiseBuffer()
      const f = c.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = noiseFreq
      const ng = c.createGain()
      env(ng, at, 0.003, peak * noiseAmt, 0.22)
      n.connect(f).connect(ng).connect(drums)
      n.start(at, Math.random())
      n.stop(at + 0.3)
    }
  }
  const crash = (at, peak, swell = false) => {
    const n = c.createBufferSource()
    n.buffer = noiseBuffer()
    const f = c.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = 5200
    const g = c.createGain()
    if (swell) {
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(peak, at + 1.4)
      g.gain.setTargetAtTime(0.0001, at + 1.45, 0.05)
    } else env(g, at, 0.003, peak, 2.2)
    n.connect(f).connect(g).connect(drums)
    n.start(at, Math.random())
    n.stop(at + 2.4)
  }
  const choirAh = (freq, at, dur, peak) => {
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = freq
    const vib = c.createOscillator()
    const vg = c.createGain()
    vib.frequency.value = 5.2
    vg.gain.value = 4
    vib.connect(vg).connect(o.detune)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + Math.min(1.6, dur * 0.3))
    g.gain.setTargetAtTime(0.0001, at + dur * 0.75, dur * 0.15)
    ;[[700, 6], [1150, 7]].forEach(([fq, q]) => {
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = fq
      bp.Q.value = q
      o.connect(bp).connect(g)
    })
    g.connect(busOut)
    o.start(at)
    vib.start(at)
    o.stop(at + dur + 1.2)
    vib.stop(at + dur + 1.2)
  }
  const brassStab = (notes, at, peak) => {
    notes.forEach((n) => {
      vo(midi(n), at, 1.3, peak, 'sawtooth', -7, 0.03)
      vo(midi(n), at, 1.3, peak, 'sawtooth', 7, 0.03)
    })
  }
  const melody = (at, len, notes, scale, shift, count) => {
    const chordPcs = new Set(notes.map((n) => n % 12))
    let t = at + 0.8 + Math.random() * 0.6
    for (let k = 0; k < count && t < at + len - 1; k++) {
      const pool = scale.filter((m) => chordPcs.has(m % 12) || Math.random() < 0.25)
      pluck(midi(pool[Math.floor(Math.random() * pool.length)] + shift), t, 0.045 + Math.random() * 0.02)
      t += [0.9, 1.2, 1.8, 2.4][Math.floor(Math.random() * 4)]
    }
  }

  const BAR = {
    calm(at, len, i, bass, notes) {
      vo(midi(bass + 12), at, len, 0.05)
      notes.forEach((n, k) => {
        vo(midi(n), at + k * 0.06, len + 0.6, 0.011, 'triangle', -6)
        vo(midi(n), at + k * 0.06, len + 0.6, 0.008, 'sine', 7)
      })
      melody(at, len, notes, MINOR_MELODY, 0, 2 + Math.floor(Math.random() * 3))
    },
    tense(at, len, i, bass, notes) {
      vo(midi(bass), at, len, 0.055)
      notes.slice(0, -1).forEach((n, k) => {
        vo(midi(n - 12), at + k * 0.06, len + 0.6, 0.011, 'triangle', -6)
        vo(midi(n - 12), at + k * 0.06, len + 0.6, 0.008, 'sine', 7)
      })
      // 낮게 맥박 치는 현 (8분음표) — 긴장을 유지
      for (let k = 0; k < 8; k++) vo(midi(bass + 12), at + k * (len / 8), len / 10, 0.012, 'sawtooth', 0, 0.02)
      melody(at, len, notes, MINOR_MELODY, -12, 1 + Math.floor(Math.random() * 2))
    },
    thriller(at, len, i, bass, notes) {
      vo(midi(bass - 12), at, len + 1, 0.05, 'sawtooth', 0, 2)
      vo(midi(bass - 11), at, len + 1, 0.03, 'sawtooth', 0, 2.5)
      vo(midi(bass), at, len + 1, 0.04, 'sine')
      notes.forEach((n, k) => vo(midi(n - 12) * (k === notes.length - 1 ? 1.06 : 1), at + k * 0.3, len, 0.006, 'triangle', k * 9))
      ;[0, len * 0.5, len * 0.78].forEach((t) => {
        drum(48, at + t, 0.32, 0.5, 0.15, 160)
        drum(44, at + t + 0.22, 0.22, 0.5, 0.1, 160)
      })
      if (Math.random() < 0.6) {
        const hi = midi(notes[notes.length - 1] + 24)
        glide(hi, hi / 1.414, at + 1 + Math.random() * 2, 2.6, 0.012, 'sine')
      }
      for (let k = 0; k < 3; k++) {
        if (Math.random() < 0.55) pluck(midi(notes[Math.floor(Math.random() * notes.length)] + 24), at + 0.8 + k * 1.6 + Math.random() * 0.3, 0.02, 1.6, [1, 0.5, 0.25])
      }
    },
    horror(at, len, i, bass, notes) {
      vo(midi(bass - 12), at, len + 1.5, 0.05, 'sine', 0, 3)
      vo(midi(bass - 12), at, len + 1.5, 0.04, 'sine', 9, 3)
      vo(midi(bass + 6), at + 0.5, len + 1, 0.012, 'sawtooth', -6, len * 0.6)
      notes.slice(1).forEach((n, k) => vo(midi(n), at + 1 + k * 0.7, len * 0.7, 0.0045, 'sawtooth', k % 2 ? 7 : -7, len * 0.4))
      if (i % 2 === 0) {
        const box = [notes[1] + 24, notes[2] + 24, notes[1] + 25, notes[3] + 23]
        box.forEach((m, k) => {
          if (Math.random() < 0.7) pluck(midi(m), at + 2 + k * 0.9 + Math.random() * 0.15, 0.016, 2.2, [1, 0.45, 0.2])
        })
      }
      if (Math.random() < 0.45) {
        const hi = midi(bass + 31)
        glide(hi, hi / 1.6, at + 3 + Math.random() * 3, 2.2, 0.006, 'sawtooth')
      }
    },
    dramatic(at, len, i, bass, notes) {
      vo(midi(bass + 12), at, len, 0.05)
      vo(midi(bass), at, len, 0.035)
      notes.forEach((n, k) => {
        vo(midi(n), at + k * 0.15, len + 1, 0.0055, 'sawtooth', -8, len * 0.45)
        vo(midi(n), at + k * 0.15, len + 1, 0.0055, 'sawtooth', 8, len * 0.45)
      })
      const arp = [notes[0], notes[1], notes[2], notes[3] || notes[2] + 12, notes[2], notes[1], notes[0] + 12, notes[1]]
      for (let k = 0; k < 16; k++) pluck(midi(arp[k % arp.length]), at + k * (len / 16), 0.022 + (k % 4 === 0 ? 0.008 : 0), 1.6)
      const pool = MINOR_MELODY.map((m) => m - 2)
      ;[0.15, 0.55].forEach((p) => {
        const m = pool[Math.floor(Math.random() * pool.length)] + 12
        vo(midi(m), at + len * p, len * 0.5, 0.02, 'triangle', 0, 0.6)
        vo(midi(m), at + len * p, len * 0.5, 0.012, 'sine', 5, 0.6)
      })
    },
    light(at, len, i, bass, notes) {
      const beat = len / 4
      ;[0, 2].forEach((b) => pluck(midi(bass + (b === 2 ? 7 : 0)), at + b * beat, 0.06, 0.28, [1, 0.3]))
      ;[1, 3].forEach((b) => notes.forEach((n) => vo(midi(n), at + b * beat, 0.18, 0.009, 'square', 0, 0.01)))
      for (let k = 0; k < 8; k++) {
        if (Math.random() < 0.6) {
          const m = MAJOR_MELODY[Math.floor(Math.random() * MAJOR_MELODY.length)]
          pluck(midi(m), at + k * (beat / 2), 0.03, 0.35, [1, 0, 0, 0.35])
        }
      }
      if (i === 3 && Math.random() < 0.6) {
        if (Math.random() < 0.5) glide(midi(60), midi(84), at + beat * 3.2, 0.35, 0.03, 'sine')
        else {
          glide(midi(72), midi(60), at + beat * 3, 0.25, 0.03, 'triangle')
          glide(midi(60), midi(79), at + beat * 3.3, 0.3, 0.03, 'triangle')
        }
      }
    },
    touching(at, len, i, bass, notes) {
      const swell = 1 + i * 0.12
      vo(midi(bass), at, len, 0.05 * swell)
      vo(midi(bass + 12), at, len, 0.03 * swell)
      notes.forEach((n, k) => {
        vo(midi(n), at + k * 0.1, len + 1, 0.006 * swell, 'sawtooth', -7, len * 0.35)
        vo(midi(n + 12), at + k * 0.1, len + 1, 0.004 * swell, 'sawtooth', 7, len * 0.35)
      })
      const up = [notes[0], notes[1], notes[2], notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[0] + 24, notes[2] + 12]
      for (let k = 0; k < 16; k++) pluck(midi(up[k % up.length]), at + k * (len / 16), 0.02 + (k % 4 === 0 ? 0.01 : 0), 1.8)
      const top = notes[notes.length - 1] + 12
      ;[[0.0, 0], [0.5, 2]].forEach(([p, step]) => {
        vo(midi(top + step), at + len * p, len * 0.48, 0.022 * swell, 'triangle', 0, 0.5)
        vo(midi(top + step), at + len * p, len * 0.48, 0.012 * swell, 'sine', 6, 0.5)
      })
      if (i === 3) crash(at + len - 1.4, 0.025, true)
    },
    sad(at, len, i, bass, notes) {
      vo(midi(bass), at, len, 0.045)
      vo(midi(bass + 12), at, len + 1, 0.012, 'sawtooth', 0, len * 0.4)
      notes.slice(0, 2).forEach((n) => vo(midi(n - 12), at + 0.4, len + 1, 0.006, 'sawtooth', -5, len * 0.5))
      const pool = notes.map((n) => n + 12).concat(notes.map((n) => n))
      let t = at + 0.6
      for (let k = 0; k < 4 && t < at + len - 1; k++) {
        pluck(midi(pool[Math.floor(Math.random() * pool.length)]), t, 0.04 - k * 0.005, 3.6)
        t += [1.6, 2.0, 2.4][Math.floor(Math.random() * 3)]
      }
      if (Math.random() < 0.5) pluck(midi(notes[0] + 24), at + len - 1.2, 0.015, 3)
    },
  }

  const state = { next: now + 0.15, bar: 0, prog: th0.progs[0], alive: true }
  const schedule = () => {
    if (!state.alive) return
    while (state.next < c.currentTime + 1.5) {
      const at = Math.max(state.next, c.currentTime + 0.05)
      const i = state.bar % 4
      if (i === 0 && state.bar > 0 && Math.random() < 0.4) state.prog = th0.progs[Math.floor(Math.random() * th0.progs.length)]
      const [bass, ...notes] = state.prog[i]
      try {
        BAR[name](at, th0.bar, i, bass, notes)
      } catch (e) {
        console.warn('배경음 한 마디 실패', e)   // 한 마디가 실패해도 음악은 계속 (다음 마디로)
      }
      state.next = at + th0.bar
      state.bar += 1
    }
  }
  const timer = setInterval(schedule, 400)
  schedule()
  return {
    stop() {
      state.alive = false
      clearInterval(timer)
      fbs.forEach((g) => g.gain.setTargetAtTime(0.0001, c.currentTime, 0.1))
      setTimeout(() => {
        busOut.disconnect()
        drums.disconnect()
      }, 1500)
    },
  }
}

// ------------------------------------------------------------------ 환경음 — 장면별 층 + 가끔 일어나는 작은 사건
//   court    법정 실내 잡음 · 멀리서 종이 넘기는 소리 · 의자 삐걱 · 헛기침 · 웅성거림
//   rain     빗소리 (+ 아주 가끔 먼 천둥)
//   thriller 초침 · 가끔 빨라지는 심장 박동
//   horror   땅 밑 저음 · 바람 · 좌우에서 들리는 속삭임 · 문 삐걱 · 벽 너머 노크 · 숨소리 · 오르골 · 쇠 긁는 소리 ·
//            가끔 모든 소리가 사라지는 정적 (세기는 설정 '공포 연출')
function startAmbience(key, fadeIn) {
  const c = ctx
  const g = c.createGain()
  g.gain.value = 0.0001
  g.gain.setTargetAtTime(1, c.currentTime, Math.max(0.3, fadeIn / 2))
  g.connect(bus.amb)
  const nodes = []
  const loopNoise = (lpFreq, level, type = 'lowpass', q = 0.7) => {
    const s = c.createBufferSource()
    s.buffer = noiseBuffer()
    s.loop = true
    const f = c.createBiquadFilter()
    f.type = type
    f.frequency.value = lpFreq
    f.Q.value = q
    const lg = c.createGain()
    lg.gain.value = level
    s.connect(f).connect(lg).connect(g)
    s.start(c.currentTime, Math.random() * 3)
    nodes.push(s)
    return { src: s, filter: f, gain: lg }
  }
  const lfo = (param, rate, depth) => {
    const o = c.createOscillator()
    const d = c.createGain()
    o.frequency.value = rate
    d.gain.value = depth
    o.connect(d).connect(param)
    o.start()
    nodes.push(o)
  }
  const drone = (freq, level, type = 'sine') => {
    const o = c.createOscillator()
    o.type = type
    o.frequency.value = freq
    const lg = c.createGain()
    lg.gain.value = level
    o.connect(lg).connect(g)
    o.start()
    nodes.push(o)
    return lg
  }
  // 한 번 일어나는 잡음 (위치 · 크기 · 대역)
  const evNoise = ({ at = 0, dur = 0.2, freq = 1000, q = 1, peak = 0.02, pan = 0, type = 'bandpass', attack = 0.005, wet = 0 }) => {
    const t = c.currentTime + at
    const s = c.createBufferSource()
    s.buffer = whiteBuffer()
    s.loop = true
    const f = c.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const eg = c.createGain()
    env(eg, t, attack, peak, dur)
    s.connect(f).connect(eg).connect(panner(c, pan, g))
    if (wet) {
      const w = c.createGain()
      w.gain.value = wet
      eg.connect(w).connect(hall('amb'))
    }
    s.start(t, Math.random() * 0.5)
    s.stop(t + attack + dur + 0.1)
  }
  const thud = (at, peak, pan = 0, freq = 70) => {
    const t = c.currentTime + at
    const o = c.createOscillator()
    o.frequency.setValueAtTime(freq * 1.6, t)
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.06)
    const eg = c.createGain()
    env(eg, t, 0.004, peak, 0.28)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 500
    o.connect(lp).connect(eg).connect(panner(c, pan, g))
    const w = c.createGain()
    w.gain.value = 0.5
    eg.connect(w).connect(hall('amb'))
    o.start(t)
    o.stop(t + 0.4)
    evNoise({ at, dur: 0.08, freq: 350, q: 0.8, peak: peak * 0.6, pan, type: 'lowpass' })
  }
  // 문 · 마루 삐걱 — 마찰(불규칙한 저주파 톱니) 이 나무 공명(좁은 대역)을 울린다
  const creak = (at, peak, pan, dur = rand(0.8, 2.2)) => {
    const t = c.currentTime + at
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(rand(14, 30), t)
    for (let k = 1; k <= 10; k++) o.frequency.linearRampToValueAtTime(rand(10, 62), t + (dur * k) / 10)
    const eg = c.createGain()
    eg.gain.setValueAtTime(0.0001, t)
    eg.gain.exponentialRampToValueAtTime(peak, t + 0.15)
    eg.gain.setValueAtTime(peak, t + dur - 0.2)
    eg.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const p = panner(c, pan, g)
    ;[[rand(520, 720), 14], [rand(1250, 1600), 11], [rand(240, 320), 9]].forEach(([f, q]) => {
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = f
      bp.Q.value = q
      o.connect(bp).connect(eg)
    })
    eg.connect(p)
    const w = c.createGain()
    w.gain.value = 0.6
    eg.connect(w).connect(hall('amb'))
    o.start(t)
    o.stop(t + dur + 0.1)
  }
  const heartbeat = (at, beats, from, to, peak) => {
    let t = at
    for (let k = 0; k < beats; k++) {
      const bpm = from + ((to - from) * k) / Math.max(1, beats - 1)
      thud(t, peak, 0, 52)
      thud(t + 0.2, peak * 0.65, 0, 46)
      t += 60 / bpm
    }
  }
  const breath = (at, peak, pan) => {
    // 들이쉼(짧게 올라감) → 내쉼(길게) — 귓가 가까이
    evNoise({ at, dur: 0.9, freq: 1400, q: 0.8, peak, pan, attack: 0.7 })
    evNoise({ at: at + 1.7, dur: 1.4, freq: 900, q: 0.7, peak: peak * 1.2, pan, attack: 0.25 })
  }
  const musicBox = (at, peak) => {
    const base = pick([76, 79, 81])
    const seq = [0, 3, 7, 6, 3, -1, 0].map((s) => base + s)
    seq.forEach((m, k) => {
      const t = at + k * rand(0.42, 0.6) * (1 + k * 0.08)      // 태엽이 풀리듯 점점 느려진다
      const f = midi(m) * (1 + rand(-0.012, 0.012))
      voice({ freq: f, at: t, peak, decay: 1.4, wet: 0.9, out: g, rev: hall('amb') })
      voice({ freq: f * 4.2, at: t, peak: peak * 0.25, decay: 0.3, wet: 0.9, out: g, rev: hall('amb') })
    })
  }
  const scrape = (at, peak, pan) => {
    const t = c.currentTime + at
    const s = c.createBufferSource()
    s.buffer = whiteBuffer()
    s.loop = true
    const f = c.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 30
    f.frequency.setValueAtTime(rand(1800, 2600), t)
    f.frequency.linearRampToValueAtTime(rand(2800, 4200), t + 1.6)
    const eg = c.createGain()
    env(eg, t, 0.3, peak, 1.4)
    s.connect(f).connect(eg).connect(panner(c, pan, g))
    const w = c.createGain()
    w.gain.value = 0.8
    eg.connect(w).connect(hall('amb'))
    s.start(t)
    s.stop(t + 2)
  }

  // ---- 바탕 층
  let events = null
  if (key === 'rain') {
    loopNoise(1100, 0.028)
    loopNoise(5200, 0.004, 'highpass')                       // 빗방울 치는 고음
    events = () => {
      if (Math.random() < 0.08) evNoise({ dur: 4, freq: 90, q: 0.5, peak: 0.05, type: 'lowpass', attack: 0.6 })   // 먼 천둥
      return rand(20, 45)
    }
  } else if (key === 'court') {
    loopNoise(320, 0.03)                                     // 넓은 실내의 공기
    drone(60, 0.0025)                                        // 형광등 · 공조 웅웅
    events = () => {
      const pan = rand(-0.8, 0.8)
      const r = Math.random()
      if (r < 0.35) evNoise({ dur: 0.22, freq: 3200, q: 0.6, peak: 0.012, pan, wet: 0.3 })                 // 종이 넘김
      else if (r < 0.55) creak(0, 0.006, pan, rand(0.3, 0.6))                                                // 의자
      else if (r < 0.7) {                                                                                     // 헛기침
        evNoise({ dur: 0.12, freq: 520, q: 1.5, peak: 0.016, pan, wet: 0.5 })
        evNoise({ at: 0.18, dur: 0.1, freq: 700, q: 1.5, peak: 0.012, pan, wet: 0.5 })
      } else if (r < 0.85) for (let k = 0; k < 3; k++) evNoise({ at: k * rand(0.12, 0.2), dur: 0.02, freq: 2600, q: 3, peak: 0.01, pan })   // 펜 톡톡
      else evNoise({ dur: 2.2, freq: 420, q: 2.5, peak: 0.008, pan, attack: 0.6, wet: 0.6 })                 // 방청석 웅성
      return rand(6, 16)
    }
  } else if (key === 'thriller') {
    loopNoise(260, 0.025)
    drone(55, 0.01)
    let tick = 0
    const tickTimer = setInterval(() => {
      if (!settings.ambient) return
      evNoise({ dur: 0.015, freq: tick++ % 2 ? 3100 : 2500, q: 6, peak: 0.012, pan: 0.4 })
    }, 1000)
    nodes.push({ stop: () => clearInterval(tickTimer) })
    events = () => {
      const sets = manifestCached?.sfx || {}
      const labels = Object.keys(sets.city || {})
      const r = Math.random()
      // 생성한 도시 소리 (지나가는 차 · 진동 · 사이렌 …) — 멀리서
      if (r < 0.4 && labels.length && sample('city', pick(labels), { out: g, gain: 0.35, pan: rand(-0.9, 0.9), lp: 3500, wet: 0.4, rev: hall('amb') })) return rand(14, 28)
      if (r < 0.7) heartbeat(0, 10, 62, 96, 0.12)
      else creak(0, 0.01, rand(-0.9, 0.9))
      return rand(14, 28)
    }
  } else if (key === 'horror') {
    // 땅 밑 저음 — 두 사인이 어긋나 천천히 맥놀이 + 숨 쉬듯 부풀었다 가라앉는 저역 잡음
    drone(41.2, 0.05)
    drone(41.9, 0.04)
    const rumble = loopNoise(95, 0.11)
    lfo(rumble.gain.gain, 0.07, 0.06)
    // 바람 — 좁은 대역이 천천히 떠돈다 · 좌우로 흔들림
    const wind = loopNoise(500, 0.04, 'bandpass', 5)
    let windT = null
    const drift = () => {
      wind.filter.frequency.setTargetAtTime(rand(260, 950), c.currentTime, 1.6)
      windT = setTimeout(drift, rand(1800, 4200))
    }
    drift()
    nodes.push({ stop: () => clearTimeout(windT) })
    // 아주 높은 귀울림 — 거의 들리지 않게
    const ring = drone(rand(5900, 6400), 0.0012)
    lfo(ring.gain, 0.11, 0.0011)
    // 생성한 바탕 소리(바람 · 먼 삐걱임)가 있으면 그 위에 겹친다
    const bedPath = manifestCached?.amb?.horror
    if (bedPath) {
      loadBuffer(bedPath, 'bgm').then((buf) => {
        if (!buf || g._stopped) return
        const bed = c.createGain()
        bed.gain.value = 0.8
        bed.connect(g)
        const loop = playLoop([buf], bed)
        nodes.push(loop)
      })
    }
    // 사건의 효과음 세트(폐가 · 병원 …) — 생성한 실제 소리. 없으면 폐가 세트 → 합성
    const setEvent = (k) => {
      const sets = manifestCached?.sfx || {}
      const set = sets[scene.sfxSet] ? scene.sfxSet : 'house'
      const labels = Object.keys(sets[set] || {})
      if (!labels.length) return false
      return sample(set, pick(labels), { out: g, gain: 0.55 * k, pan: pick([-1, 1]) * rand(0.3, 0.95),
        rate: rand(0.9, 1.02), lp: rand(2500, 6000), wet: 0.7, rev: hall('amb') })
    }
    events = () => {
      const lvl = scareLevel()
      if (lvl === 'off') return rand(20, 40)
      const soft = lvl === 'soft'
      const k = soft ? 0.55 : horrorGain()            // 난이도가 높을수록 조금 더 가깝게
      const side = () => pick([-1, 1]) * rand(0.5, 0.98)
      const r = Math.random()
      if (r < 0.45 && setEvent(k)) return soft ? rand(10, 24) : rand(5, 14) * horrorPace()
      if (r < 0.34) {
        if (!whisper({ gain: k })) creak(0, 0.02 * k, side())
        if (!soft && Math.random() < 0.25) setTimeout(() => whisper({ gain: k, pan: -0.9 }), 450)   // 양쪽에서 동시에
      } else if (r < 0.5) creak(0, 0.022 * k, side())
      else if (r < 0.62) [0, rand(0.35, 0.5), rand(0.9, 1.3)].forEach((t) => thud(t, 0.16 * k, side(), 64))   // 벽 너머 노크
      else if (r < 0.72) breath(0, 0.02 * k, rand(-0.3, 0.3))
      else if (r < 0.8) heartbeat(0, 12, 58, 110, 0.15 * k)
      else if (r < 0.88) musicBox(0, 0.012 * k)
      else if (r < 0.95) scrape(0, 0.012 * k, side())
      else if (!soft) {
        // 정적 — 모든 소리가 빠지고 … 귓가에서 무언가
        const release = addDuck(0.04, 0.0001, 0.5)
        setTimeout(() => {
          if (Math.random() < 0.6) whisper({ close: true, gain: 1 })
          else breath(0, 0.035, 0)
          setTimeout(() => release(2.5), 1500)
        }, rand(3000, 5000) * 1)
      }
      return soft ? rand(10, 24) : rand(5, 14) * horrorPace()   // 난이도가 높을수록 잦게
    }
  }

  let evT = null
  if (events) {
    const loop = (first) => {
      let wait = rand(3, 8)
      if (!first) {
        try {
          if (ctx.state === 'running' && settings.ambient) wait = events()
        } catch (e) {
          console.warn('환경음 실패', e)
        }
      }
      evT = setTimeout(() => loop(false), wait * 1000)
    }
    loop(true)
  }
  return {
    stop(fade = 1) {
      clearTimeout(evT)
      g._stopped = true
      const t = c.currentTime
      g.gain.cancelScheduledValues(t)
      g.gain.setTargetAtTime(0.0001, t, Math.max(0.05, fade / 3))
      setTimeout(() => {
        nodes.forEach((n) => {
          try { n.stop() } catch { /* 이미 멈춤 */ }
        })
        g.disconnect()
      }, fade * 1000 + 800)
    },
  }
}

// ------------------------------------------------------------------ 피아노 합성 (녹음 증거 재생)
const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }
function noteFreq(n) {
  const m = /^([A-G]#?)(\d)$/.exec(n)
  if (!m) return null
  const mi = (Number(m[2]) + 1) * 12 + NOTE[m[1]]
  return 440 * Math.pow(2, (mi - 69) / 12)
}

/** notes 를 피아노 소리로 재생. '-' 는 쉼표. 반환값: stop() */
export function playMelody(notes, { tempo = 0.26, muffled = true, onNote } = {}) {
  const c = ac()
  if (!c) return () => {}
  const out = c.createGain()
  out.gain.value = 0.9
  const lp = c.createBiquadFilter() // 벽 너머로 들리는 듯 먹먹하게
  lp.type = 'lowpass'
  lp.frequency.value = muffled ? 1100 : 6000
  out.connect(lp).connect(bus.sfx)
  // 녹음을 듣는 동안 배경음은 낮춘다
  const release = addDuck(0.12, 0.25, 0.3)
  const restore = () => release(0.8)
  const start = c.currentTime + 0.05
  const timers = []
  notes.forEach((n, i) => {
    const t = start + i * tempo
    timers.push(setTimeout(() => onNote?.(i), (t - c.currentTime) * 1000))
    const f = noteFreq(n)
    if (!f) return
    ;[1, 2, 3].forEach((h, k) => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = k === 0 ? 'triangle' : 'sine'
      o.frequency.value = f * h
      env(g, t, 0.006, [0.35, 0.08, 0.03][k], 1.4)
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + 1.5)
    })
  })
  timers.push(setTimeout(() => {
    onNote?.(-1)
    restore()
  }, (notes.length * tempo + 0.6) * 1000))
  return () => {
    timers.forEach(clearTimeout)
    restore()
    out.gain.setTargetAtTime(0.0001, c.currentTime, 0.05)
  }
}

// ------------------------------------------------------------------ 시네마틱 음악 (테마가 없을 때만 — 예전 방식)
//   분위기별 합성 악곡 — 피아노 아르페지오 + 현악 패드 (+ tense 는 심장 박동). 배경음은 잠시 내린다
const SCORES = {
  sad: [3.6, [[45, 57, 60, 64], [41, 57, 60, 65], [36, 55, 60, 64], [43, 55, 59, 62]], 'down'],
  warm: [3.0, [[36, 55, 60, 64], [43, 55, 59, 62], [45, 57, 60, 64], [41, 57, 60, 65]], 'up'],
  hopeful: [2.8, [[41, 57, 60, 65], [43, 55, 59, 62], [40, 55, 59, 64], [45, 57, 60, 64]], 'up'],
  bitter: [3.4, [[38, 57, 62, 65], [34, 53, 58, 62], [41, 53, 57, 60], [36, 55, 60, 64]], 'down'],
  tense: [2.6, [[40, 52, 55, 59], [41, 53, 56, 60], [40, 52, 55, 59], [38, 50, 53, 57]], 'pulse'],
  mystery: [3.2, [[40, 55, 59, 62], [36, 55, 60, 64], [38, 54, 57, 62], [35, 54, 59, 62]], 'down'],
}

export function playScore(mood = 'mystery') {
  const c = ac()
  if (!c || !settings.ambient) return () => {}
  const [bar, prog, dir] = SCORES[mood] || SCORES.mystery
  const bus2 = c.createGain()
  bus2.gain.value = 0.0001
  bus2.gain.exponentialRampToValueAtTime(0.9 * (settings.bgmVolume ?? 0.7), c.currentTime + 2.5)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = mood === 'tense' ? 1200 : 2600
  bus2.connect(lp).connect(bus.master)
  const echo = c.createDelay(1)
  echo.delayTime.value = 0.42
  const fb = c.createGain()
  fb.gain.value = 0.28
  lp.connect(echo).connect(fb).connect(echo)
  echo.connect(bus.master)
  const release = addDuck(0.25, 0.4, 1)

  const pad = (f, at, dur, peak) => {
    ;[-5, 6].forEach((det) => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = det
      const soft = c.createBiquadFilter()
      soft.type = 'lowpass'
      soft.frequency.value = 900
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(peak, at + dur * 0.4)
      g.gain.setTargetAtTime(0.0001, at + dur * 0.75, dur * 0.2)
      o.connect(soft).connect(g).connect(bus2)
      o.start(at)
      o.stop(at + dur + 1)
    })
  }
  const piano = (f, at, peak) => {
    ;[1, 2, 3].forEach((h, k) => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = k ? 'sine' : 'triangle'
      o.frequency.value = f * h
      env(g, at, 0.006, peak * [1, 0.25, 0.08][k], 2.4)
      o.connect(g).connect(bus2)
      o.start(at)
      o.stop(at + 2.6)
    })
  }
  const heart = (at) => {
    ;[0, 0.22].forEach((d, k) => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.frequency.setValueAtTime(70, at + d)
      o.frequency.exponentialRampToValueAtTime(40, at + d + 0.18)
      env(g, at + d, 0.005, k ? 0.18 : 0.28, 0.2)
      o.connect(g).connect(bus2)
      o.start(at + d)
      o.stop(at + d + 0.4)
    })
  }
  const st = { next: c.currentTime + 0.3, n: 0, alive: true }
  const tick = () => {
    if (!st.alive) return
    while (st.next < c.currentTime + 1.2) {
      const [bass, ...tones] = prog[st.n % prog.length]
      const at = Math.max(st.next, c.currentTime + 0.05)
      piano(midi(bass), at, 0.05)
      tones.forEach((t) => pad(midi(t), at, bar + 0.4, 0.006))
      const seq = dir === 'down' ? [...tones].reverse().map((t) => t + 12) : tones.map((t) => t + 12)
      const step = bar / 8
      if (dir === 'pulse') {
        heart(at)
        heart(at + bar / 2)
        piano(midi(tones[2] + 12), at + step * 3, 0.03)
      } else {
        for (let i = 0; i < 8; i++) piano(midi(seq[i % seq.length] + (i >= 4 ? 12 : 0) * (st.n % 2)), at + i * step, 0.022 + (i === 0 ? 0.015 : 0))
      }
      st.next = at + bar
      st.n += 1
    }
  }
  const timer = setInterval(tick, 300)
  tick()
  return () => {
    st.alive = false
    clearInterval(timer)
    const t = c.currentTime
    bus2.gain.setTargetAtTime(0.0001, t, 0.6)
    fb.gain.setTargetAtTime(0.0001, t, 0.6)
    release(2)
    setTimeout(() => bus2.disconnect(), 4000)
  }
}
