// 게임 문지기 (2026-11-24 사용자 지시 — 서비스 · 점검 중 · 준비 중)
//   상태는 hub/games.js 의 GAMES[].status 한 곳에서 읽는다 (어드민이 서버에서 덮은 값이 오면 그 값 — hub/liveStatus.js, 2026-11-25)
//   서비스(live)   — 누구나 바로 (문지기 없음과 같다)
//   점검 중(maint) · 준비 중(soon) — 일반 사용자는 잠김 화면(게임 사진 · 이름 · 상태 · 다른 게임 단추), 운영자는 위 띠 한 줄만 보고 제약 없이 들어간다
import { useAccount } from '../../account/index.js'
import { previewOn } from '../../operator.js'
import { GAMES, statusLabel } from '../../hub/games.js'
import { useLiveStatus } from '../../hub/useLiveStatus.js'

const note = {
  position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
  minHeight: 20, padding: '2px 8px', fontSize: 14, lineHeight: 1.3, color: '#f0e8d8', background: 'rgba(0,0,0,.55)', textAlign: 'center',
}

// 게임 id 의 상태 — 목록에 없으면 준비 중으로 (새 시제품이 실수로 공개되지 않게)
export const gateStatus = (id, games = GAMES) => games.find((g) => g.id === id)?.status || 'soon'
// 일반 사용자가 들어가는가 / 운영자 띠를 보이는가
export const gateOpen = (status, operator) => status === 'live' || !!operator
export const gateNote = (status) => status !== 'live'

export default function ProtoGate({ id, children }) {
  const user = useAccount()
  useLiveStatus()
  const status = gateStatus(id)
  const label = statusLabel({ status })
  const op = previewOn(user)
  if (status === 'live') return children
  if (op) {
    return (
      <>
        <div style={note} data-prep-note role="note">{label}인 게임 — 운영자만 열 수 있어요</div>
        {children}
      </>
    )
  }
  return <Locked game={GAMES.find((g) => g.id === id)} status={status} label={label} />
}

// 잠김 화면 — 공유 · 홍보 · 검색 링크(/beat 등)로 바로 온 사람이 보는 첫 화면이라 허브 카드처럼: 게임 사진 + 이름 + 상태 + 다른 게임 단추 하나
//   (2026-11-25 전체 시험: 예전엔 까만 바탕에 글 한 줄 · 브라우저 기본 회색 단추라 깨진 화면처럼 보였다). 글자 14px 이상 · 단추 48px
const L = {
  main: { position: 'relative', minHeight: '100vh', display: 'grid', placeItems: 'center', overflow: 'hidden', boxSizing: 'border-box',
    padding: '72px 20px calc(32px + env(safe-area-inset-bottom))', background: '#0d0c0b', color: '#f0e8d8', textAlign: 'center' },
  img: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 35%', filter: 'grayscale(.6) brightness(.5)' },
  shade: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(13,12,11,.35) 0%, rgba(13,12,11,.7) 55%, rgba(13,12,11,.95) 100%)' },
  card: { position: 'relative', display: 'grid', justifyItems: 'center', gap: 12, width: 'min(420px, 100%)' },
  tag: { padding: '4px 12px', borderRadius: 999, border: '1px solid rgba(226,184,102,.6)', background: 'rgba(13,12,11,.6)', color: '#e2b866', fontSize: 14, fontWeight: 800 },
  h1: { margin: 0, fontFamily: "'Noto Serif KR', serif", fontSize: 30, lineHeight: 1.25, wordBreak: 'keep-all', textShadow: '0 2px 10px rgba(0,0,0,.7)' },
  p: { margin: 0, fontSize: 15, color: '#e6dcc8' },
  btn: { marginTop: 8, minHeight: 48, padding: '0 28px', border: 0, borderRadius: 12, background: '#e2b866', color: '#1c140d', fontSize: 16, fontWeight: 900, fontFamily: 'inherit', cursor: 'pointer' },
}

function Locked({ game, status, label }) {
  return (
    <main style={L.main} data-gate-lock={status}>
      {game?.image ? <img src={game.image} alt="" style={L.img} decoding="async" /> : null}
      <span style={L.shade} aria-hidden="true" />
      <div style={L.card}>
        <span style={L.tag}>{label}</span>
        {game?.title ? <h1 style={L.h1}>{game.title}</h1> : null}
        <p style={L.p}>{status === 'maint' ? '곧 다시 열어요' : '곧 열어요'}</p>
        <button type="button" style={L.btn} onClick={() => { window.location.hash = '/hub' }}>다른 게임 하기</button>
      </div>
    </main>
  )
}
