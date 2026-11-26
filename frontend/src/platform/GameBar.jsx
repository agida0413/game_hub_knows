// 게임 머리줄 (2026-11-26 허브 유지 + 게임 독립) — 단독 실행 게임은 허브 '홈' 단추 대신 이것: 게임 아이콘 단추 하나(같은 자리 · 같은 폭)
//   누르면 아래에서 판이 올라온다: 게임 이름 · 처음 화면(나가기) · 공유. 다른 게임 입구는 여기 없다(결과 화면 끝 MoreGames 하나 — 사용자 승인)
//   저장되지 않는 판이 진행 중이면(useRunGuard) '처음 화면' 전에 한 번 묻는다
import { Menu, RotateCcw, Share2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isRunning } from '../hub/hubback.js'
import { share, shareUrl, track } from './index.js'

export default function GameBar({ meta, onRestart }) {
  const [open, setOpen] = useState(false)
  const [ask, setAsk] = useState(false)
  const [note, setNote] = useState('')
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setAsk(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  const close = () => { setOpen(false); setAsk(false); setNote('') }
  const restart = () => {
    if (isRunning() && !ask) { setAsk(true); return }
    track(meta.id, 'ab', { label: `ab91_${meta.id}_home` })
    close()
    onRestart()
  }
  const doShare = async () => {
    const r = await share(meta.id, `${meta.title} — ${meta.share}\n${shareUrl(meta.id)}`)
    setNote(r === 'copied' ? '링크를 복사했어요' : r === 'fail' ? '복사하지 못했어요' : '')
  }
  return (
    <>
      <button type="button" className="mg-bar" data-gamebar={meta.id} aria-label={`${meta.title} — 메뉴`} aria-expanded={open} onClick={() => setOpen(true)}>
        {meta.images?.icon ? <img src={meta.images.icon} alt="" draggable="false" /> : null}
        <Menu size={18} strokeWidth={2.4} aria-hidden />
      </button>
      {open && (
        <div className="mg-sheet-bg" role="presentation" onClick={close}>
          <div className="mg-sheet" role="dialog" aria-modal="true" aria-label={meta.title} onClick={(e) => e.stopPropagation()}
            style={{ '--mg-color': meta.color || '#ffd479' }}>
            <div className="mg-sheet-head">
              {meta.images?.icon ? <img src={meta.images.icon} alt="" draggable="false" /> : null}
              <b>{meta.title}</b>
              <button type="button" className="mg-x" aria-label="닫기" onClick={close} autoFocus><X size={22} strokeWidth={2.4} /></button>
            </div>
            {ask ? <p className="mg-ask" role="alert">나가면 이번 판은 사라져요</p> : null}
            <div className="mg-sheet-row">
              <button type="button" className="mg-sheet-btn" data-act="restart" onClick={restart}>
                <RotateCcw size={22} strokeWidth={2.4} aria-hidden />{ask ? '나가기' : '처음 화면'}
              </button>
              <button type="button" className="mg-sheet-btn main" data-act="share-game" onClick={doShare}>
                <Share2 size={22} strokeWidth={2.4} aria-hidden />공유
              </button>
            </div>
            <p className="mg-note" role="status">{note}</p>
          </div>
        </div>
      )}
    </>
  )
}
