// 지연 불러오기(조각 파일) 도우미 — react 없음 (tests/lazy-games.test.mjs). App.jsx 가 React.lazy 와 함께 쓴다
//   배포로 옛 조각 파일이 없어진 탭(새 배포 전에 열어 둔 탭)이면 한 번만 새로 고침해 새 파일을 받는다.
//   한 번 새로 고쳤는데도 실패하면 오류를 그대로 던져 오류 화면(ErrorBoundary — '홈으로')으로
const KEY = 'mg.chunk.reload'

export function loadOnce(load, {
  storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
  reload = () => window.location.reload(),
} = {}) {
  return load().then((m) => {
    try { storage?.removeItem(KEY) } catch { /* 저장 불가 */ }
    return m
  }, (e) => {
    let again = false
    try {
      again = !!storage && !storage.getItem(KEY)
      if (again) storage.setItem(KEY, '1')
    } catch { again = false }
    if (!again) throw e
    reload()
    return new Promise(() => {})   // 새로 고침을 기다린다 (그동안 불러오는 중 화면)
  })
}
