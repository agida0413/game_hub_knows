// 도마 박자 자산 버전(11/26 급한 고침) — public/beat 아래 곡 · 사진은 이름이 같아도 내용이 바뀔 수 있다(c2n · c2x 새 곡).
//   운영 정적 파일은 Cache-Control max-age=86400 + stale-while-revalidate=604800 이라 폰이 옛 파일을 계속 쓴다 ->
//   빌드 때 파일 내용 sha256 앞 8자를 모아(vite.config.js define __BEAT_V__) 화면이 주소 끝에 ?v=<sha8> 을 붙인다(assets.js).
//   파일이 바뀌면 주소가 저절로 바뀐다 — 손으로 적지 않는다. 시험: tests/v2-beat-assets.test.mjs (vite 설정만 이 파일을 부른다 — 화면 묶음에는 안 들어간다)
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export function assetVersions(publicDir, sub = 'beat') {
  const out = {}
  const walk = (dir, rel) => {
    let names = []
    try { names = readdirSync(dir) } catch { return }
    for (const n of names) {
      const p = join(dir, n), r = `${rel}/${n}`
      if (statSync(p).isDirectory()) walk(p, r)
      else out[r] = createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 8)
    }
  }
  walk(join(publicDir, sub), `/${sub}`)
  return out
}
