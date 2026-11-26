// 공유 — navigator.share 를 쓰고, 안 되면 클립보드에 복사 (nav 를 받아 node 에서도 시험)
//   돌려주는 값: 'shared' · 'copied' · 'cancel'(공유창을 닫음) · 'fail'
export async function shareOrCopy(text, nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  try {
    if (nav && typeof nav.share === 'function') {
      await nav.share({ text })
      return 'shared'
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancel'
  }
  try {
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
      await nav.clipboard.writeText(text)
      return 'copied'
    }
  } catch { /* 아래 대체 방법 */ }
  try {
    if (typeof document !== 'undefined') {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok ? 'copied' : 'fail'
    }
  } catch { /* 복사 불가 */ }
  return 'fail'
}
