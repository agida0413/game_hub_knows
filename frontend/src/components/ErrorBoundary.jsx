import { Component } from 'react'
import { countError } from '../errorCount.js'

// 화면 그리기 오류가 나도 까만 화면 대신 안내 — 홈(막간 허브)으로 돌아갈 수 있게 (오류 내용은 콘솔에 · 서버에는 게임별 횟수만 — errorCount.js)
//   모든 게임을 감싸므로 '사건 목록'(최후의 변론 말)이 아니라 '홈' — 단추는 #/hub (#/ 는 기기에 따라 사건 목록이라 쓰지 않는다 · 2026-11-25 전체 시험)
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('화면 오류', error, info?.componentStack)
    countError()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="loading-screen remake-notice">
        <div>
          <h2>화면을 그리다 문제가 생겼어요</h2>
          <p>홈에서 다시 들어와 주세요.</p>
          <button
            className="btn primary"
            onClick={() => {
              window.location.hash = '#/hub'
              window.location.reload()
            }}
          >
            홈으로
          </button>
        </div>
      </div>
    )
  }
}
