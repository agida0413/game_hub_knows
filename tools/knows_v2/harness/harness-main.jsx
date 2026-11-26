// 촬영 · 측정용 — ProtoGate(운영자 확인)를 거치지 않고 Proto 를 바로 올린다. 공용 파일은 건드리지 않는다
import { createRoot } from 'react-dom/client'
import Proto from './src/games/v2/knows/Proto.jsx'
createRoot(document.getElementById('root')).render(<Proto />)
