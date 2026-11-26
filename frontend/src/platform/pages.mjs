// 게임별 얼굴 — game.json 한 장으로 /g/<게임> 첫 화면 HTML · 홈 화면 앱 정보(manifest) · 사이트맵 줄을 만든다 (react · 브라우저 없음)
//   빌드(vite.config.js 의 gamePages 플러그인)가 dist/index.html 을 바탕으로 dist/g/<게임>/index.html · manifest.webmanifest 를 쓰고,
//   시험(tests/platform.test.mjs)이 같은 함수를 바로 부른다. 서버(game_backend share_games.py)도 같은 game.json 을 읽는다
//   문구에 이모지 · 실존 서비스 이름 금지. 평점 · 후기처럼 없는 값은 넣지 않는다

export const ORIGIN = 'https://example.com'
export const STATUSES = Object.freeze(['live', 'maint', 'soon'])
const ID = /^[a-z][a-z0-9]{1,15}$/
const PUBLIC_PATH = /^\/[a-z0-9][a-z0-9_./-]*\.(webp|jpg|png)$/

// game.json 검사 — 문제 목록(빈 배열이면 통과). 준비 중(soon) 게임은 공유 · 소개가 없어도 된다
export function checkMeta(m) {
  const bad = []
  const need = (k, ok) => { if (!ok) bad.push(k) }
  need('id', ID.test(m?.id || ''))
  for (const k of ['title', 'en', 'short', 'tagline']) need(k, typeof m?.[k] === 'string' && m[k].trim().length > 0)
  need('status', STATUSES.includes(m?.status))
  need('categories', Array.isArray(m?.categories) && m.categories.length > 0)
  need('hash', /^\/[a-z0-9/]+$/.test(m?.hash || ''))
  need('images.card', PUBLIC_PATH.test(m?.images?.card || ''))
  if (m?.status !== 'soon') {
    need('share', typeof m?.share === 'string' && m.share.length >= 10)
    need('about', Array.isArray(m?.about) && m.about.length >= 3 && m.about.length <= 4 && m.about.every((s) => typeof s === 'string' && s.length > 5))
    need('images.share', PUBLIC_PATH.test(m?.images?.share || ''))
  }
  if (m?.standalone) {
    need('images.icon', PUBLIC_PATH.test(m?.images?.icon || ''))
    need('images.icon512', PUBLIC_PATH.test(m?.images?.icon512 || ''))
    need('color', /^#[0-9a-f]{6}$/i.test(m?.color || ''))
    need('background', /^#[0-9a-f]{6}$/i.test(m?.background || ''))
  }
  return bad
}

// 공유 · 검색 페이지를 만드는 게임 — 준비 중이 아닌 것 (서비스 · 점검 중)
export const hasPage = (m) => m.status !== 'soon'
export const gamePath = (m) => `/g/${m.id}`

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// <script> 안에 넣는 JSON — 태그가 닫히지 않게 < > & 를 유니코드 이스케이프로 (서버 share_games.py 와 같은 규칙)
const safeJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')

export function gameJsonLd(m, origin = ORIGIN) {
  return {
    '@context': 'https://schema.org', '@type': 'VideoGame', name: m.title, description: m.share,
    url: `${origin}${gamePath(m)}`, image: `${origin}${m.images.share}`, inLanguage: 'ko',
    applicationCategory: 'Game', gamePlatform: 'Web browser', operatingSystem: 'Any',
    isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
    publisher: { '@type': 'Organization', name: '막간', url: origin },
  }
}

// 게임 첫 화면 HTML — 빌드한 index.html(스크립트 · 스타일 태그 그대로)의 머리말만 그 게임 것으로 바꾸고,
//   #root 안에 게임 소개 3~4줄을 넣는다(검색엔진 · 스크립트 꺼진 브라우저가 읽는다. 화면 앱이 뜨면 React 가 이 자리를 덮는다)
export function gamePage(indexHtml, m, origin = ORIGIN) {
  const url = `${origin}${gamePath(m)}`
  const title = `${m.title} - 막간`
  const img = `${origin}${m.images.share}`
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(m.share)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    m.standalone ? `<link rel="manifest" href="${gamePath(m)}/manifest.webmanifest" />` : '',
    m.standalone ? `<link rel="apple-touch-icon" href="${esc(m.images.icon)}" />` : '',
    m.standalone ? '<meta name="mobile-web-app-capable" content="yes" />' : '',   // 홈 화면에서 앱처럼 (안드로이드 · 아이폰)
    m.standalone ? '<meta name="apple-mobile-web-app-capable" content="yes" />' : '',
    m.standalone ? '<meta name="apple-mobile-web-app-status-bar-style" content="black" />' : '',
    m.background ? `<meta name="theme-color" content="${esc(m.background)}" />` : '',
    `<meta name="apple-mobile-web-app-title" content="${esc(m.title)}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="막간" />',
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(m.share)}" />`,
    '<meta property="og:locale" content="ko_KR" />',
    `<meta property="og:image" content="${esc(img)}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:url" content="${esc(url)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(m.share)}" />`,
    `<meta name="twitter:image" content="${esc(img)}" />`,
    `<script type="application/ld+json">${safeJson(gameJsonLd(m, origin))}</script>`,
  ].filter(Boolean).join('\n    ')
  let html = String(indexHtml)
  // 막간 첫 화면용 머리말(제목 · 설명 · 미리보기 · 대표 주소 · 구조화 데이터 · 색)을 걷어 내고 게임 것을 넣는다 — 글꼴 · 아이콘 · 스크립트 태그는 그대로
  html = html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+(name|property)="(description|og:[a-z:_]+|twitter:[a-z:_]+|theme-color|mobile-web-app-capable|apple-mobile-web-app-[a-z-]+)"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="(canonical|apple-touch-icon|manifest)"[^>]*>\s*/gi, '')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/i, '')
    .replace(/<!--[\s\S]*?-->\s*/g, '')
  if (!/<\/head>/i.test(html) || !/<div id="root"><\/div>/.test(html)) throw new Error('index.html 모양이 다르다 — </head> · <div id="root"></div> 를 찾지 못함')
  html = html.replace(/<\/head>/i, `    ${head}\n  </head>`)
  html = html.replace(/<html lang="ko">/i, `<html lang="ko" data-game="${esc(m.id)}">`)
  const about = `<main class="mg-about"><h1>${esc(m.title)}</h1>${m.about.map((s) => `<p>${esc(s)}</p>`).join('')}<p><a href="${gamePath(m)}">바로 하기</a></p></main>`
  return html.replace('<div id="root"></div>', `<div id="root">${about}</div>`)
}

// 홈 화면 앱 정보 — 그 게임만 (시작 주소 · 범위 /g/<게임>)
export function gameManifest(m) {
  return {
    name: `${m.title} - 막간`,
    short_name: m.title,
    description: m.share,
    lang: 'ko',
    start_url: `${gamePath(m)}?src=pwa`,
    scope: `${gamePath(m)}`,
    id: gamePath(m),
    display: 'standalone',
    orientation: 'portrait',
    background_color: m.background,
    theme_color: m.background,
    icons: [
      { src: m.images.icon, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: m.images.icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}

// 사이트맵 — 첫 화면 + 준비 중이 아닌 게임의 /g/<게임> (허브 노출 순서)
export function sitemapXml(metas, origin = ORIGIN) {
  const urls = [`${origin}/`, ...metas.filter(hasPage).map((m) => `${origin}${gamePath(m)}`)]
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `  <url><loc>${u}</loc></url>`), '</urlset>', ''].join('\n')
}
