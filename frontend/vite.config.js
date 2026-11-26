import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { assetVersions } from './src/games/v2/beat/versions.node.mjs'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readMetas } from './src/platform/metas.node.mjs'
import { checkMeta, gameManifest, gamePage, hasPage } from './src/platform/pages.mjs'

// 게임별 얼굴 (2026-11-26 허브 유지 + 게임 독립) — 빌드가 끝나면 game.json 마다 dist/g/<게임>/index.html(그 게임 머리말 · 소개 · 대표 주소)
//   · 단독 실행 게임은 dist/g/<게임>/manifest.webmanifest(홈 화면 앱 정보)도. 화면 nginx 가 /g/<게임> 에 이 파일을 준다 (주소창에 '#' 없음)
function gamePages() {
  let outDir = 'dist'
  return {
    name: 'makgan-game-pages',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir },
    closeBundle() {
      const dist = fileURLToPath(new URL(`./${outDir}/`, import.meta.url))
      const index = readFileSync(join(dist, 'index.html'), 'utf8')
      for (const m of readMetas(fileURLToPath(new URL('./src/games', import.meta.url)))) {
        const bad = checkMeta(m)
        if (bad.length) throw new Error(`${m.file}: game.json 칸이 비었거나 틀림 — ${bad.join(', ')}`)
        if (!hasPage(m)) continue
        const dir = join(dist, 'g', m.id)
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, 'index.html'), gamePage(index, m))
        if (m.standalone) writeFileSync(join(dir, 'manifest.webmanifest'), JSON.stringify(gameManifest(m), null, 2))
      }
    },
  }
}

// 개발 서버: /api/* → game_backend (배포 시에는 gateway 가 같은 규칙으로 라우팅)
// 화면 하나: index.html (AI KNOWS YOU)
export default defineConfig({
  plugins: [react(), gamePages()],
  // 도마 박자 곡 · 사진 주소 버전(?v=<내용 sha8>) — 이름이 같은 새 파일을 폰 캐시가 옛 것으로 내지 않게 (src/games/v2/beat/versions.node.mjs)
  define: { __BEAT_V__: JSON.stringify(assetVersions(fileURLToPath(new URL('./public', import.meta.url)))) },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY || 'http://localhost:4001', changeOrigin: true },
    },
  },
})
