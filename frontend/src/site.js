// 사이트 주소 — 화면 코드가 읽는 한 곳 (2026-11-24 도메인 이전: old.example.com → example.com)
//   SITE_HOST    정식 주소 (www 없는 쪽 — www 는 게이트웨이가 이리로 301)
//   LEGACY_HOSTS 옛 주소 — 게이트웨이가 화면 요청을 '주소 이사' 화면(move.html · move/out.js)으로 보낸다
//   다른 곳의 같은 값: 게이트웨이 · 서버는 쿠버네티스 site-config (deploy/k8s/overlays/prod/kustomization.yaml),
//                     검색엔진용 정적 파일은 index.html · public/sitemap.xml · public/robots.txt 에 직접 (빌드가 바꾸지 않는다)
//   로컬 시험 빌드만 VITE_SITE_ORIGIN · VITE_LEGACY_HOSTS 로 바꾼다 (예: http://example.com:4000 — 운영 빌드는 그대로)
// react 없음 — node --test 가 바로 읽는다 (import.meta.env 는 vite 빌드에만 있다)
const ENV = (typeof import.meta !== 'undefined' && import.meta.env) || {}

export const SITE_ORIGIN = String(ENV.VITE_SITE_ORIGIN || 'https://example.com').replace(/\/+$/, '')
export const SITE_HOST = new URL(SITE_ORIGIN).hostname
export const LEGACY_HOSTS = Object.freeze(String(ENV.VITE_LEGACY_HOSTS || 'old.example.com').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean))

export const isLegacyHost = (host) => LEGACY_HOSTS.includes(String(host || '').toLowerCase())

// 공유 링크 등 '밖으로 내보내는 주소'의 앞부분 — 옛 주소에서 열린 탭이어도 새 주소로, 로컬 · 시험 주소는 그대로
export function publicOrigin(loc = typeof window !== 'undefined' ? window.location : null) {
  if (!loc || !loc.origin || isLegacyHost(loc.hostname)) return SITE_ORIGIN
  return loc.origin
}
