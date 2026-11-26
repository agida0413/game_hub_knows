// 인라인 SVG 아이콘 (외부 아이콘 폰트 없이 currentColor 로 테마 대응)
const base = (size) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
})

export const IconGavel = ({ size = 20 }) => (
  <svg {...base(size)}>
    <path d="m14 13-7.5 7.5a2.12 2.12 0 0 1-3-3L11 10" />
    <path d="m16 16 6-6" />
    <path d="m8 8 6-6" />
    <path d="m9 7 8 8" />
    <path d="m21 11-8-8" />
  </svg>
)
export const IconScale = ({ size = 20 }) => (
  <svg {...base(size)}>
    <path d="M12 3v18M7 21h10M5 7h14" />
    <path d="m5 7-3 7a3 3 0 0 0 6 0L5 7ZM19 7l-3 7a3 3 0 0 0 6 0l-3-7Z" />
  </svg>
)
export const IconTrophy = ({ size = 20 }) => (
  <svg {...base(size)}>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3" />
  </svg>
)
export const IconFile = ({ size = 20 }) => (
  <svg {...base(size)}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" />
    <path d="M14 3v6h6M8 13h8M8 17h5" />
  </svg>
)
export const IconSend = ({ size = 20 }) => (
  <svg {...base(size)}>
    <path d="m22 2-7 20-4-9-9-4 20-7Z" />
    <path d="M22 2 11 13" />
  </svg>
)
export const IconBack = ({ size = 20 }) => (
  <svg {...base(size)}>
    <path d="m15 18-6-6 6-6" />
  </svg>
)
export const IconClose = ({ size = 20 }) => (
  <svg {...base(size)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)
export const IconCheck = ({ size = 20 }) => (
  <svg {...base(size)}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
export const IconAlert = ({ size = 20 }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
)
export const IconInfo = ({ size = 20 }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
)
export const IconUser = ({ size = 20 }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
)
export const IconLadder = ({ size = 20 }) => (
  <svg {...base(size)}>
    <path d="M4 20h4v-4h4v-4h4V8h4" />
    <path d="M18 4l2 2-2 2" />
  </svg>
)
export const IconGear = ({ size = 20 }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
)
export const IconPlay = ({ size = 20 }) => (
  <svg {...base(size)}>
    <path d="M7 4l12 8-12 8z" />
  </svg>
)

// 현장 조사 도구 — 살펴보기 · 뒤지기 · 손전등 · 감식등
export const IconLook = ({ size = 20 }) => (
  <svg {...base(size)}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m20 20-5.2-5.2" />
    <path d="M8 9.2a3 3 0 0 1 2.6-1.7" />
  </svg>
)
export const IconSearchHand = ({ size = 20 }) => (
  <svg {...base(size)}>
    <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" />
    <path d="M11 11.5V4a1.5 1.5 0 0 1 3 0v7.5" />
    <path d="M14 11.5V5.5a1.5 1.5 0 0 1 3 0V13" />
    <path d="M17 9.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1.2a6 6 0 0 1-4.6-2.1L4.3 16.6a1.6 1.6 0 0 1 2.3-2.2L8 15.8" />
  </svg>
)
export const IconFlashlight = ({ size = 20 }) => (
  <svg {...base(size)}>
    <path d="M7 3h10l-2 6v11a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V9z" />
    <path d="M7 6h10" />
    <path d="M12 13v2" />
  </svg>
)
export const IconUvLamp = ({ size = 20 }) => (
  <svg {...base(size)}>
    <path d="M12 2v2M4.9 4.9l1.4 1.4M2 12h2M19.1 4.9l-1.4 1.4M22 12h-2" />
    <path d="M8 14a4 4 0 1 1 8 0v2H8z" />
    <path d="M9 19c1 .7 2 1 3 1s2-.3 3-1" />
    <path d="M10 22h4" />
  </svg>
)
