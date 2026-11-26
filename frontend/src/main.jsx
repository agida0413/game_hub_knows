// 공용 저장 키 이사 — 맨 첫 import (다른 모듈이 저장소를 읽기 전에, platform/earlyKeys.js)
import './platform/earlyKeys.js'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { captureSrc } from './src.js'
import { tidyAllKeys } from './platform/keys.js'
import { gameEvent } from './analytics.js'
import { installErrorCount } from './errorCount.js'
import { ToastProvider } from './components/Toast.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './styles/base.css'
import './styles/mobile.css'
import './styles/readable.css'

tidyAllKeys()
captureSrc()
installErrorCount(window, (g) => gameEvent(g, 'error'), () => 'knows')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ToastProvider>
  </StrictMode>,
)
