// 운영자 판별 — 운영자 계정이면 항상 운영자로 본다 (2026-11-24 사용자 지시: '운영자 미리보기' 스위치를 없앰 — 헷갈림 방지)
//   운영자와 일반 사용자의 화면 차이는 '준비 중 게임 카드를 누르면 들어가느냐'뿐이다 (사건 · 홈 · 게임 목록은 같다)
//   서버로 가는 요청 머리(X-MG-Preview)는 운영자 계정이면 항상 붙는다 — AI 하루 횟수 무제한 · 실화 법정 시험용 (서버 EARLY_ACCESS_USERS 와 짝)
//   지표에서 운영자 기록을 빼는 것(서버 INTERNAL_ACCOUNTS)은 이와 상관없이 늘 유지된다
import { isOperator } from './hub/games.js'

export const PREVIEW_HEADER = 'X-MG-Preview'

// user: 허브 계정. storage 인자는 옛 호출 모양만 남김 (무시)
export const previewOn = (user, _storage) => isOperator(user)
