// 공용 기기 저장 키 이사 aij.* → mg.* (2026-11 내부 이름 makgan) — main.jsx 의 맨 첫 import
//   ES 모듈은 import 순서대로 먼저 실행된다 → auth.js(로그인) · player.js(방문자 ID) · storage.js(설정) 가 저장소를 읽기 전에 옮겨 둔다
//   옮기는 목록 · 정리 날짜: platform/keys.js SHARED_MOVES · tidySharedKeys
import { tidySharedKeys } from './keys.js'

tidySharedKeys()
