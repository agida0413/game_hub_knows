// game.json 모두 읽기 — node 전용(빌드 · 시험). 화면 코드는 이 파일을 가져오지 않는다 (fs 를 쓰므로)
//   위치: src/games/**/game.json (게임 폴더마다 한 장). 순서는 id 순 — 허브 노출 순서는 hub/games.js
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export function findMetaFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...findMetaFiles(p))
    else if (name === 'game.json') out.push(p)
  }
  return out.sort()
}

export function readMetas(gamesDir) {
  return findMetaFiles(gamesDir)
    .map((file) => ({ ...JSON.parse(readFileSync(file, 'utf8')), file }))
    .sort((a, b) => a.id.localeCompare(b.id))
}
