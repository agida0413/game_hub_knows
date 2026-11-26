// 「숨긴 사진」 AI 단계 사다리 · 진행 기록 — 순수 함수 (react · 브라우저 없음 · node --test 로 검증)
//   한 판(라운드 3)에서 내가 과반을 숨기면(AI 를 두 번 이상 속이면) 다음 단계가 열린다
//   단계가 오르면 AI 가 세진다: 사진마다 더 여러 번 보고(reps) · 헷갈리면 다시 본다(둘 중 하나, 여러 번, 셋 중 하나)
//   · 사진이 5장에서 6장, 7장으로 · 진행이 조금 빨라진다. 숫자는 sim.js 로 잰 적중률이 매끄럽게 오르도록 맞춘 값(simulateLadder)
//   3단계는 반복을 늘리면서 다시 보기도 켠다(2단계 0.62 · 3단계 0.64 로 평평하던 것이 0.62 · 0.69 · 0.75 로 매끄럽게)
//   미끼 사진(이미 아는 무관 사진 섞기)은 시뮬레이션에서 적중률을 거의 못 올려(0.823 대 0.828) 넣지 않았다
//   기록은 이 기기에만(PROG_KEY · 숫자 요약뿐, 반응 시간 없음). 정식 출시 때 GameSync keys 에 PROG_KEY 를 넣으면 계정으로 옮겨진다
//   9 · 10단계 완화(11/24 2라운드): 5라운드 한 판은 신호가 있는 사람의 돌파율이 1% 라 둘 다 3라운드로. 10단계는 다시 보기 기준 .8 그대로라 가장 세다(신호 있는 사람 돌파 약 5%)
import { MIN_SOA, cleanHabit, habitCarry } from './engine.js'
import { SETS } from './sets.js'

export const PROG_KEY = 'knows.v3'   // 게임 id 로 묶음(2026-11-26, 옛 knw3.v1 은 platform/keys.js 가 한 번 옮겨 붙임)
export const MAX_STAGE = 10

// 진행 빠르기 — isi: 누른 뒤 다음 사진까지(ms) · deadline: 제한 시간(ms). 사진이 바뀌는 간격은 늘 MIN_SOA(0.6초) 이상
export const SPEEDS = [
  { id: 1, name: '보통', isi: [300, 500], deadline: 1100 },
  { id: 2, name: '조금 빠름', isi: [270, 460], deadline: 1050 },
  { id: 3, name: '빠름', isi: [240, 420], deadline: 1000 },
  { id: 4, name: '아주 빠름', isi: [220, 380], deadline: 950 },
]

// AI 단계 — ai: 이름(실존 인물 아님) · n: 사진 수 · reps: 사진마다 나오는 횟수(테두리 1번 포함) · tbMax: 다시 보기 최대
//   confTb: 이 확신 아래면 다시 본다 · tbReps: 다시 볼 때 사진마다 횟수 · tbK: 다시 볼 장수(2 둘 중 하나 · 3 셋 중 하나)
//   rounds: 한 판 라운드 수 · speed: SPEEDS 번호
const RAW = [
  { ai: '견습생', n: 5, reps: 3, tbMax: 0, confTb: 0.5, tbReps: 4, tbK: 2, rounds: 3, speed: 1 },
  { ai: '눈치꾼', n: 5, reps: 3, tbMax: 1, confTb: 0.4, tbReps: 4, tbK: 2, rounds: 3, speed: 1 },
  { ai: '관찰자', n: 5, reps: 4, tbMax: 1, confTb: 0.4, tbReps: 4, tbK: 2, rounds: 3, speed: 1 },
  { ai: '추적자', n: 5, reps: 4, tbMax: 1, confTb: 0.5, tbReps: 4, tbK: 2, rounds: 3, speed: 2 },
  { ai: '분석가', n: 6, reps: 5, tbMax: 1, confTb: 0.55, tbReps: 4, tbK: 2, rounds: 3, speed: 2 },
  { ai: '탐정', n: 6, reps: 6, tbMax: 1, confTb: 0.6, tbReps: 4, tbK: 2, rounds: 3, speed: 3 },
  { ai: '심리술사', n: 6, reps: 6, tbMax: 2, confTb: 0.6, tbReps: 4, tbK: 2, rounds: 3, speed: 3 },
  { ai: '마술사', n: 7, reps: 6, tbMax: 2, confTb: 0.7, tbReps: 4, tbK: 3, rounds: 3, speed: 3 },
  { ai: '예언자', n: 7, reps: 7, tbMax: 2, confTb: 0.7, tbReps: 4, tbK: 3, rounds: 3, speed: 4 },
  { ai: '독심술사', n: 7, reps: 7, tbMax: 2, confTb: 0.8, tbReps: 5, tbK: 3, rounds: 3, speed: 4 },
]

export const STAGES = RAW.map((s, i) => {
  const sp = SPEEDS[s.speed - 1]
  return Object.freeze({ stage: i + 1, ...s, isi: sp.isi, deadline: sp.deadline, minSoa: MIN_SOA })
})

export const stageCfg = (stage) => STAGES[Math.min(MAX_STAGE, Math.max(1, stage | 0)) - 1]

// 이기는 조건 — 과반을 숨기기 (3판이면 2번 · 5판이면 3번)
export const needOf = (rounds) => Math.floor(rounds / 2) + 1
export const wonGame = (rounds, me) => me >= needOf(rounds)

// 오늘의 판 — 모두 같은 세트 · 같은 씨앗 · 같은 난이도(3단계 값, 3라운드)
export const DAILY = Object.freeze({ ...STAGES[2], stage: 0, ai: '오늘의 AI' })

// 내 칭호 — 깬 가장 높은 단계로
const TITLES = ['도전자', '시치미', '시치미', '능청꾼', '능청꾼', '무표정', '무표정', '포커페이스', '포커페이스', '철가면', '전설의 포커페이스']
export const titleOf = (best) => TITLES[Math.min(MAX_STAGE, Math.max(0, best | 0))]

// 열린 사진 세트 — 깬 단계까지
export const openSets = (best) => SETS.filter((s) => s.unlock <= (best | 0))
export const setUnlockedBy = (stage) => ((stage | 0) >= 1 && SETS.find((s) => s.unlock === (stage | 0))) || null

// ---- 기록 ----
export function freshProg() {
  return { v: 1, best: 0, streak: 0, bestStreak: 0, plays: 0, wins: 0, daily: null }
}

const nat = (x, hi = 1e6) => (Number.isInteger(x) && x >= 0 && x <= hi ? x : 0)
const DATE = /^\d{4}-\d{2}-\d{2}$/

// 저장된 글을 믿지 않는다 — 형식이 틀리면 그 칸만 0
export function cleanProg(raw) {
  const p = freshProg()
  if (!raw || typeof raw !== 'object') return p
  p.best = nat(raw.best, MAX_STAGE)
  p.streak = nat(raw.streak)
  p.bestStreak = Math.max(nat(raw.bestStreak), p.streak)
  p.plays = nat(raw.plays)
  p.wins = Math.min(nat(raw.wins), p.plays)
  const d = raw.daily
  if (d && typeof d === 'object' && DATE.test(d.date) && Number.isInteger(d.ai) && Number.isInteger(d.me)) {
    p.daily = { date: d.date, ai: nat(d.ai, 9), me: nat(d.me, 9) }
  }
  return p
}

export function loadProg(storage) {
  try {
    const s = storage?.getItem(PROG_KEY)
    return cleanProg(s ? JSON.parse(s) : null)
  } catch { return freshProg() }
}

export function saveProg(storage, prog) {
  if (!storage) return false
  try { storage.setItem(PROG_KEY, JSON.stringify(cleanProg(prog))); return true } catch { return false }
}

// 지금 도전할 단계 — 깬 단계 다음(10단계를 깨면 10단계 다시)
export const currentStage = (prog) => Math.min(MAX_STAGE, (prog?.best | 0) + 1)

/**
 * 한 판 결과를 기록에 넣는다
 * @param prog  지금 기록
 * @param game  { stage, rounds, ai, me, daily(오늘의 판이면 true), date('YYYY-MM-DD') }
 * @returns { prog(새 기록), won, firstClear(이 단계를 처음 깸), unlocked(새로 열린 세트 | null), next(다음에 도전할 단계) }
 */
export function applyGame(prog, game) {
  const p = cleanProg(prog)
  const won = wonGame(game.rounds, game.me)
  p.plays += 1
  if (won) p.wins += 1
  if (game.daily) {
    // 오늘의 판 — 그날 첫 기록만 남긴다(공유 문구용) · 사다리 · 연승은 건드리지 않는다
    if (!p.daily || p.daily.date !== game.date) p.daily = { date: game.date, ai: game.ai, me: game.me }
    return { prog: p, won, firstClear: false, unlocked: null, next: currentStage(p) }
  }
  p.streak = won ? p.streak + 1 : 0
  p.bestStreak = Math.max(p.bestStreak, p.streak)
  const firstClear = won && game.stage > p.best
  if (firstClear) p.best = Math.min(MAX_STAGE, game.stage)
  return { prog: p, won, firstClear, unlocked: firstClear ? setUnlockedBy(game.stage) : null, next: currentStage(p) }
}

// ---- 오늘의 판 ----
export const kstDate = (t = Date.now()) => new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10)

function hash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h >>> 0
}

// 날짜 하나로 모두 같은 판 — 세트는 날마다 차례로(잠긴 세트도 오늘의 판에서는 미리 본다) · 씨앗은 날짜에서
export function dailyOf(date) {
  const day = Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000)
  const set = SETS[((day % SETS.length) + SETS.length) % SETS.length]
  return { date, seed: hash('knows3:' + date), set: set.id }
}

// ---- 습관 이월 저장 (이 기기에만 · 숫자 6개 · 반응 시간 원자료 없음) ----
export const HABIT_KEY = 'knows.h1'   // 이 기기에만(계정에 올리지 않음) — 옛 knw3.h1 은 platform/keys.js 가 옮겨 붙임
export function loadHabit(storage) {
  try {
    const s = storage?.getItem(HABIT_KEY)
    return cleanHabit(s ? JSON.parse(s) : null)
  } catch { return cleanHabit(null) }
}
export function saveHabit(storage, habit) {
  if (!storage) return false
  try { storage.setItem(HABIT_KEY, JSON.stringify(habitCarry(habit))); return true } catch { return false }
}
