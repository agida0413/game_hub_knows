// CI 점검 (dev-ops/scripts/run-tests.sh frontend_lint) — 정의되지 않은 이름만 잡는다.
//   vite build 는 import 를 빠뜨린 이름(예: josa)을 통과시켜, 그 화면을 열 때에야 런타임 오류가 난다 (2026-11-22 발견)
import globals from 'globals'
import react from 'eslint-plugin-react'
import hooks from 'eslint-plugin-react-hooks'   // 코드 속 eslint-disable 주석이 가리키는 규칙 이름만 알게 (규칙은 켜지 않음)

export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.worker },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': hooks },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: { 'no-undef': 'error', 'react/jsx-no-undef': 'error', 'react/jsx-uses-vars': 'error' },
  },
]
