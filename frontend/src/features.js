// 최후의 변론 — 켜고 끄는 기능 (플랫폼 v2 단계 F · 2026-11-23 사용자 지시: 게임성과 관계없는 것 폐기, 할 게 너무 많아 보여 이탈)
//   '끈다' = 화면 · 진입 버튼만 숨기고 그 주소는 사건 목록으로 돌린다. 서버 API · DB 데이터는 그대로 (되돌릴 수 있게)
//   다시 켜려면 여기 값만 true 로.
export const FEATURES = {
  realCourt: false,   // 실화 법정(고소장 접수 · #/m/…) — 진입 버튼 · 화면
  rank: false,        // 랭크 점수(RP) · 티어 · 시즌 · 순위표 · '점수 획득 가능' 표시 · 판결 뒤 점수 변화 — 점수는 허브 통합 EXP 로
  avatar: false,      // 법정 아바타 — 화면에서 완전히 내림 (2026-11-24: 만들기 · 법정 표시 · 안내 모두). 예전에 만든 사람이 지우는 길만 계정 관리 화면에 남김
  hall: false,        // 명변론 전당 — 판결 뒤 올리기 · 목록 탭
  // 로그인 없이 플레이 (플랫폼 F-2 · reports/design_guest_play.md) — 켜면 계정이 없는 사람도 사건 목록 · 재판을 손님 토큰으로 한다.
  //   손님 재판 판사 · 비용은 서버 설정(GUEST_JUDGE=llm · GUEST_DAILY_BUDGET_USD=2 — 2026-11-23 사용자 확인)
  guestPlay: true,
}

// 로그인 없이 볼 수 있는 최후의 변론 화면 (guestPlay 가 켜졌을 때) — 나의 기록 · 실화 법정 등 계정이 필요한 화면은 지금처럼 로그인 화면
const GUEST_ROUTES = new Set(['title', 'archive', 'case', 'trial'])
export const guestRoute = (route) => featureOn('guestPlay') && GUEST_ROUTES.has(route?.name || 'title')

export const featureOn = (key) => !!FEATURES[key]

// 꺼진 기능의 주소 → 어디로 보낼지 (null 이면 그대로)
//   route: router.js useRoute() 의 { name, id }
export function redirectFor(route) {
  if (route.name === 'm' && !featureOn('realCourt')) return '/archive'
  if (route.name === 'records' && route.id === 'friends') return '/records/me'   // 친구 기능은 내렸다 (2026-11-24)
  if (route.name === 'records') {
    const tab = route.id || 'me'
    if ((tab === 'rank' || tab === 'tiers' || tab === 'season') && !featureOn('rank')) return '/records/me'
    if (tab === 'hall' && !featureOn('hall')) return '/records/me'
  }
  return null
}
